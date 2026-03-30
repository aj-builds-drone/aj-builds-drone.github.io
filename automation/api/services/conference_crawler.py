"""
Conference / Workshop Crawler — Discover drone researchers from conference speaker lists.

Scrapes publicly available speaker/program pages from major robotics and drone
conferences. Extracts speaker names, affiliations, and talk titles to create
DroneProspect records. These are the WARMEST leads — actively presenting research.

Target conferences:
- ICRA (IEEE International Conference on Robotics and Automation)
- IROS (IEEE/RSJ International Conference on Intelligent Robots and Systems)
- RSS (Robotics: Science and Systems)
- AUVSI XPONENTIAL
- InterDrone / Commercial UAV Expo
"""

import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urljoin
from uuid import uuid4

import aiohttp
from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.config import settings
from api.database import async_session_factory
from api.models.prospect import DiscoveryBatch, DroneProspect

logger = logging.getLogger("drone.conference_crawler")

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")

# Conference speaker / program pages to scrape
# URLs updated periodically — these are best-effort targets
CONFERENCE_PAGES = [
    # ICRA
    {
        "conference": "ICRA",
        "name": "IEEE ICRA",
        "urls": [
            "https://2025.ieee-icra.org/program/keynotes/",
            "https://2025.ieee-icra.org/program/workshops/",
            "https://2025.ieee-icra.org/program/invited-speakers/",
            "https://2026.ieee-icra.org/program/keynotes/",
            "https://2026.ieee-icra.org/program/workshops/",
        ],
    },
    # IROS
    {
        "conference": "IROS",
        "name": "IEEE IROS",
        "urls": [
            "https://iros2025.org/program/keynotes/",
            "https://iros2025.org/program/workshops/",
            "https://iros2026.org/program/keynotes/",
        ],
    },
    # RSS
    {
        "conference": "RSS",
        "name": "Robotics: Science and Systems",
        "urls": [
            "https://roboticsconference.org/program/keynotes/",
            "https://roboticsconference.org/program/papers/",
        ],
    },
    # AUVSI XPONENTIAL
    {
        "conference": "AUVSI",
        "name": "AUVSI XPONENTIAL",
        "urls": [
            "https://www.xponential.org/xponential2025/public/Content.aspx?ID=2890",
            "https://www.xponential.org/xponential2026/public/Content.aspx?ID=2890",
        ],
    },
    # Commercial UAV Expo (formerly InterDrone)
    {
        "conference": "UAV_Expo",
        "name": "Commercial UAV Expo",
        "urls": [
            "https://www.expouav.com/speakers/",
            "https://www.expouav.com/conference/agenda/",
        ],
    },
    # AIAA SciTech (drone sessions)
    {
        "conference": "AIAA",
        "name": "AIAA SciTech",
        "urls": [
            "https://www.aiaa.org/SciTech/program/keynote-speakers",
        ],
    },
]

# Drone-related keywords to identify relevant talks
DRONE_KEYWORDS = {
    "uav", "drone", "unmanned", "aerial", "quadrotor", "uas",
    "autonomous flight", "swarm", "multirotor", "vtol", "evtol",
    "slam", "navigation", "perception", "lidar", "mapping",
    "px4", "ardupilot", "ros", "path planning",
    "inspection", "remote sensing", "photogrammetry",
    "aerial robot", "flying robot", "micro air vehicle",
}


async def _fetch_page(session: aiohttp.ClientSession, url: str) -> Optional[str]:
    """Fetch a page with polite headers."""
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; DroneResearchBot/1.0; academic-outreach)",
        "Accept": "text/html,application/xhtml+xml",
    }
    try:
        async with session.get(
            url, headers=headers,
            timeout=aiohttp.ClientTimeout(total=20),
            allow_redirects=True,
        ) as resp:
            if resp.status != 200:
                logger.warning("HTTP %d for %s", resp.status, url)
                return None
            return await resp.text()
    except Exception as e:
        logger.error("Fetch error for %s: %s", url, e)
        return None


def _extract_speakers_from_html(html: str, base_url: str, conference: str) -> list[dict]:
    """
    Extract speaker info from a conference page.
    Returns list of {name, affiliation, talk_title, email, profile_url}.
    """
    soup = BeautifulSoup(html, "html.parser")
    speakers = []

    # Strategy 1: Speaker cards (common on conference sites)
    for card in soup.select(
        ".speaker-card, .speaker, .keynote, .person-card, "
        ".views-row, article.speaker, .session-speaker, "
        ".presenter, .panelist, .workshop-organizer, "
        ".card, .profile-card"
    ):
        speaker = _parse_speaker_card(card, base_url)
        if speaker and speaker.get("name"):
            speaker["conference"] = conference
            speakers.append(speaker)

    # Strategy 2: Heading blocks (name as heading, details below)
    if not speakers:
        for heading in soup.select("h2, h3, h4"):
            text = heading.get_text(strip=True)
            if len(text) < 4 or len(text) > 80:
                continue
            # Skip section headers
            if any(kw in text.lower() for kw in (
                "program", "schedule", "keynote", "workshop", "session",
                "registration", "venue", "contact", "about",
            )):
                continue

            speaker = {"name": text, "conference": conference}

            # Look at siblings for affiliation / talk title
            sibling = heading.find_next_sibling()
            if sibling:
                sib_text = sibling.get_text(" ", strip=True)
                # Affiliation often follows name
                if len(sib_text) < 200:
                    speaker["affiliation"] = sib_text
                emails = EMAIL_RE.findall(sib_text)
                if emails:
                    speaker["email"] = emails[0]

            link = heading.find("a")
            if link and link.get("href"):
                speaker["profile_url"] = urljoin(base_url, link["href"])

            speakers.append(speaker)

    # Strategy 3: Table rows
    if not speakers:
        for row in soup.select("table tr"):
            cells = row.select("td")
            if len(cells) >= 2:
                name = cells[0].get_text(strip=True)
                if len(name) < 4 or len(name) > 80:
                    continue
                speaker = {
                    "name": name,
                    "affiliation": cells[1].get_text(strip=True) if len(cells) > 1 else "",
                    "talk_title": cells[2].get_text(strip=True) if len(cells) > 2 else "",
                    "conference": conference,
                }
                speakers.append(speaker)

    return speakers


def _parse_speaker_card(card, base_url: str) -> dict:
    """Parse a speaker card element."""
    speaker = {}

    # Name
    name_el = card.select_one(
        "h2 a, h3 a, h4 a, .name, .speaker-name, "
        ".title a, h2, h3, h4, strong"
    )
    if name_el:
        speaker["name"] = name_el.get_text(strip=True)
        if name_el.name == "a" and name_el.get("href"):
            speaker["profile_url"] = urljoin(base_url, name_el["href"])

    # Affiliation
    aff_el = card.select_one(
        ".affiliation, .organization, .institution, "
        ".company, .subtitle, .speaker-affiliation"
    )
    if aff_el:
        speaker["affiliation"] = aff_el.get_text(strip=True)

    # Talk title
    talk_el = card.select_one(
        ".talk-title, .session-title, .presentation-title, "
        ".talk, .abstract-title"
    )
    if talk_el:
        speaker["talk_title"] = talk_el.get_text(strip=True)

    # Email
    email_el = card.select_one("a[href^='mailto:']")
    if email_el:
        speaker["email"] = email_el["href"].replace("mailto:", "").strip()
    else:
        text = card.get_text(" ", strip=True)
        emails = EMAIL_RE.findall(text)
        if emails:
            speaker["email"] = emails[0]

    return speaker


def _is_drone_relevant(speaker: dict) -> bool:
    """Check if a speaker's talk/affiliation is drone-related."""
    text = " ".join([
        speaker.get("talk_title", ""),
        speaker.get("affiliation", ""),
        speaker.get("name", ""),
    ]).lower()
    return any(kw in text for kw in DRONE_KEYWORDS)


async def _process_speakers(
    db: AsyncSession,
    speakers: list[dict],
    batch: DiscoveryBatch,
    conference_name: str,
) -> int:
    """Create prospect records from conference speakers."""
    new_count = 0

    for speaker in speakers:
        name = speaker.get("name", "").strip()
        if not name or len(name) < 3:
            continue

        affiliation = speaker.get("affiliation", "").strip()
        email = speaker.get("email")
        talk_title = speaker.get("talk_title", "")

        # Dedup by email
        if email:
            existing = await db.execute(
                select(DroneProspect).where(DroneProspect.email == email)
            )
            if existing.scalar_one_or_none():
                batch.prospects_found += 1
                continue

        # Dedup by name + org
        if affiliation:
            existing = await db.execute(
                select(DroneProspect).where(
                    DroneProspect.name == name,
                    DroneProspect.organization == affiliation,
                )
            )
            if existing.scalar_one_or_none():
                batch.prospects_found += 1
                continue

        # Infer org type
        org_type = "university"
        if affiliation:
            aff_lower = affiliation.lower()
            if any(k in aff_lower for k in ("inc", "corp", "ltd", "llc", "gmbh")):
                org_type = "startup"
            elif any(k in aff_lower for k in ("nasa", "noaa", "army", "navy", "darpa", "faa")):
                org_type = "government"

        prospect = DroneProspect(
            id=uuid4(),
            name=name,
            title=f"Conference Speaker ({conference_name})",
            organization=affiliation or f"{conference_name} speaker",
            organization_type=org_type,
            email=email,
            research_areas=None,
            source="conference",
            source_url=speaker.get("profile_url"),
            discovery_batch_id=batch.id,
            status="discovered",
            notes=f"Talk: {talk_title[:200]}" if talk_title else None,
        )

        db.add(prospect)
        new_count += 1
        batch.prospects_found += 1
        batch.prospects_new += 1

        logger.info(
            "Conference: %s @ %s — %s (%s)",
            name, affiliation, talk_title[:60] if talk_title else "N/A", conference_name,
        )

    return new_count


async def crawl_conferences(conferences: Optional[list[dict]] = None) -> dict:
    """
    Crawl conference speaker/program pages to discover drone researchers.

    Args:
        conferences: List of conference dicts with 'conference', 'name', 'urls'.
                    Defaults to CONFERENCE_PAGES.

    Returns:
        {"batch_id": str, "found": int, "new": int, "conferences_scraped": int}
    """
    targets = conferences or CONFERENCE_PAGES

    async with async_session_factory() as db:
        batch = DiscoveryBatch(
            id=uuid4(),
            source="conference",
            query=", ".join(t["name"] for t in targets[:5]),
            status="running",
            started_at=datetime.now(timezone.utc),
        )
        db.add(batch)
        await db.flush()

        total_new = 0
        conferences_scraped = 0

        async with aiohttp.ClientSession() as http:
            for conf in targets:
                conf_name = conf["name"]
                conf_key = conf["conference"]

                for url in conf["urls"]:
                    logger.info("Crawling %s — %s", conf_name, url)
                    html = await _fetch_page(http, url)
                    if not html:
                        continue

                    speakers = _extract_speakers_from_html(html, url, conf_key)
                    if speakers:
                        n = await _process_speakers(db, speakers, batch, conf_name)
                        total_new += n
                        await db.flush()
                        conferences_scraped += 1

                    await asyncio.sleep(3)  # polite delay

        batch.status = "complete"
        batch.completed_at = datetime.now(timezone.utc)
        await db.commit()

        logger.info(
            "Conference crawl complete: found=%d, new=%d, conferences=%d",
            batch.prospects_found, batch.prospects_new, conferences_scraped,
        )
        return {
            "batch_id": str(batch.id),
            "found": batch.prospects_found,
            "new": batch.prospects_new,
            "conferences_scraped": conferences_scraped,
        }
