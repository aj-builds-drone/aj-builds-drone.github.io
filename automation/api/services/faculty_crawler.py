"""
Faculty Page Crawler — Discover drone professors from university department pages.

Crawls /faculty or /people pages of Aerospace, ME, EE, CS departments at
target universities. Extracts professor names, emails, research interests,
and lab pages to create DroneProspect records.
"""

import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urljoin, urlparse
from uuid import uuid4

import aiohttp
from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.config import settings
from api.database import async_session_factory
from api.models.prospect import DiscoveryBatch, DroneProspect

logger = logging.getLogger("drone.faculty_crawler")

# Target universities and their department URLs
# In production, this would be loaded from a YAML config or DB table
TARGET_DEPARTMENTS = [
    # ── US Top 20 (original) ──
    ("MIT", "Aeronautics and Astronautics", "https://aeroastro.mit.edu/people/faculty/"),
    ("MIT", "EECS", "https://www.eecs.mit.edu/people/faculty-advisors/"),
    ("Stanford", "Aeronautics & Astronautics", "https://aa.stanford.edu/people/faculty"),
    ("Carnegie Mellon", "Robotics Institute", "https://www.ri.cmu.edu/people/"),
    ("Georgia Tech", "Aerospace Engineering", "https://ae.gatech.edu/people/faculty"),
    ("UT Austin", "Aerospace Engineering", "https://www.ae.utexas.edu/people/faculty"),
    ("UC Berkeley", "EECS", "https://eecs.berkeley.edu/people/faculty"),
    ("Purdue", "AAE", "https://engineering.purdue.edu/AAE/people/faculty"),
    ("University of Michigan", "Robotics", "https://robotics.umich.edu/people/"),
    ("Virginia Tech", "Aerospace & Ocean Engineering", "https://aoe.vt.edu/people/faculty.html"),
    ("Penn State", "Aerospace Engineering", "https://www.aero.psu.edu/department/directory/faculty.aspx"),
    ("University of Maryland", "Aerospace Engineering", "https://aero.umd.edu/people/faculty"),
    ("University of Illinois", "Aerospace Engineering", "https://aerospace.illinois.edu/directory/faculty"),
    ("Texas A&M", "Aerospace Engineering", "https://engineering.tamu.edu/aerospace/profiles/faculty.html"),
    ("University of Florida", "MAE", "https://mae.ufl.edu/people/faculty/"),
    ("University of Washington", "A&A", "https://www.aa.washington.edu/people/faculty"),
    ("Ohio State", "Mechanical & Aerospace", "https://mae.osu.edu/people/faculty"),
    ("Cornell", "MAE", "https://www.mae.cornell.edu/mae/people/faculty"),
    ("University of Colorado", "Aerospace", "https://www.colorado.edu/aerospace/academics/faculty"),
    ("Arizona State", "Mechanical & Aerospace", "https://semte.engineering.asu.edu/mechanical-aerospace-faculty/"),
    # ── US Expanded ──
    ("Caltech", "Aerospace (GALCIT)", "https://www.galcit.caltech.edu/people"),
    ("UCLA", "Mechanical & Aerospace", "https://www.mae.ucla.edu/people/faculty/"),
    ("USC", "Aerospace & Mechanical", "https://ame.usc.edu/directory/faculty/"),
    ("UC San Diego", "MAE", "https://mae.ucsd.edu/people/faculty"),
    ("Northwestern", "Mechanical Engineering", "https://www.mccormick.northwestern.edu/mechanical/people/faculty/"),
    ("Princeton", "MAE", "https://mae.princeton.edu/people/faculty"),
    ("Johns Hopkins", "Mechanical Engineering", "https://me.jhu.edu/faculty/"),
    ("Duke", "Mechanical Engineering", "https://mems.duke.edu/faculty"),
    ("University of Virginia", "MAE", "https://engineering.virginia.edu/departments/mechanical-and-aerospace-engineering/people"),
    ("Iowa State", "Aerospace Engineering", "https://www.aere.iastate.edu/people/faculty/"),
    ("University of Cincinnati", "Aerospace Engineering", "https://ceas.uc.edu/academics/departments/aerospace-engineering-engineering-mechanics/people.html"),
    ("NC State", "MAE", "https://mae.ncsu.edu/people/faculty/"),
    ("Rensselaer", "Mechanical & Aerospace", "https://mane.rpi.edu/people/faculty"),
    ("University of Minnesota", "AEM", "https://cse.umn.edu/aem/people"),
    # ── International — Europe ──
    ("ETH Zurich", "Autonomous Systems Lab", "https://asl.ethz.ch/the-lab/people.html"),
    ("TU Delft", "Aerospace Engineering", "https://www.tudelft.nl/en/ae/organisation/departments/control-and-operations/people"),
    ("Imperial College London", "Aeronautics", "https://www.imperial.ac.uk/aeronautics/people/academic-staff/"),
    ("University of Oxford", "Engineering Science", "https://eng.ox.ac.uk/people/"),
    ("KTH Stockholm", "Robotics", "https://www.kth.se/is/rpl/division-of-robotics-perception-and-learning-1.779439"),
    ("TU Munich", "Aerospace Engineering", "https://www.epc.ed.tum.de/en/lrt/team/"),
    ("EPFL", "Intelligent Systems Lab", "https://lis.epfl.ch/people/"),
    ("University of Bologna", "DEI", "https://dei.unibo.it/en/department/people"),
    ("Cranfield University", "Aerospace Transport Systems", "https://www.cranfield.ac.uk/centres/centre-for-autonomous-and-cyber-physical-systems"),
    # ── International — Asia-Pacific ──
    ("HKUST", "ECE", "https://ece.hkust.edu.hk/people/faculty"),
    ("NUS Singapore", "Mechanical Engineering", "https://cde.nus.edu.sg/me/staff/academic-staff/"),
    ("NTU Singapore", "MAE", "https://www.ntu.edu.sg/mae/about-us/our-people/faculty"),
    ("University of Tokyo", "Aerospace Engineering", "https://www.aerospace.t.u-tokyo.ac.jp/en/member/"),
    ("KAIST", "Aerospace Engineering", "https://ae.kaist.ac.kr/eng/page/sub0501.do"),
    ("Tsinghua University", "Automation", "https://www.au.tsinghua.edu.cn/en/Faculty.htm"),
    ("Seoul National University", "Aerospace Engineering", "https://aerospace.snu.ac.kr/en/faculty"),
    # ── International — Australia ──
    ("University of Sydney", "ACFR", "https://www.sydney.edu.au/engineering/our-research/robotics-and-intelligent-systems/australian-centre-for-field-robotics.html"),
    ("QUT Brisbane", "Robotics", "https://research.qut.edu.au/qcr/people/"),
    ("ANU Canberra", "Robotics", "https://comp.anu.edu.au/people/"),
    # ── Cross-disciplinary: Agriculture, Geology, Civil, Environmental (added 2026-03-30) ──
    ("UC Davis", "Biological & Agricultural Engineering", "https://bae.ucdavis.edu/people/faculty"),
    ("Oregon State", "Geosciences", "https://geo.oregonstate.edu/people"),
    ("University of Florida", "Agricultural & Biological Engineering", "https://abe.ufl.edu/people/faculty/"),
    ("Texas A&M", "Civil Engineering", "https://engineering.tamu.edu/civil/profiles/faculty.html"),
    ("Purdue", "Agricultural & Biological Engineering", "https://engineering.purdue.edu/ABE/people/faculty"),
    ("University of Minnesota", "Bioproducts & Biosystems Engineering", "https://bbe.umn.edu/people/faculty"),
    ("Colorado School of Mines", "Geology & Geological Engineering", "https://geology.mines.edu/faculty-list/"),
    ("Virginia Tech", "Civil & Environmental Engineering", "https://cee.vt.edu/people/faculty.html"),
    ("NC State", "Biological & Agricultural Engineering", "https://www.bae.ncsu.edu/people/faculty/"),
    ("Michigan State", "Biosystems & Agricultural Engineering", "https://www.egr.msu.edu/bae/people/faculty"),
    ("Penn State", "Civil & Environmental Engineering", "https://www.cee.psu.edu/department/directory/faculty.aspx"),
    ("Iowa State", "Agricultural & Biosystems Engineering", "https://www.abe.iastate.edu/people/faculty/"),
    ("Kansas State", "Biological & Agricultural Engineering", "https://www.bae.k-state.edu/people/faculty/"),
    ("University of Georgia", "College of Engineering", "https://engineering.uga.edu/people/faculty"),
    ("UPenn", "Mechanical Engineering (GRASP Lab)", "https://www.grasp.upenn.edu/people/"),
    ("ETH Zurich", "Environmental Systems Science", "https://usys.ethz.ch/en/people.html"),
    ("TU Delft", "Civil Engineering & Geosciences", "https://www.tudelft.nl/en/ceg/about-faculty/departments/geoscience-remote-sensing/staff"),
]

# Drone-related keywords to filter faculty by research interests
DRONE_KEYWORDS = {
    "uav", "drone", "unmanned", "aerial", "quadrotor", "multirotor",
    "slam", "autonomous", "robotics", "flight", "navigation",
    "fpga", "embedded systems", "real-time", "edge computing",
    "ros", "px4", "ardupilot", "control systems",
    "lidar", "computer vision", "perception", "sensor fusion",
    "swarm", "path planning", "localization", "mapping",
    "remote sensing", "inspection", "avionics",
}

# Email pattern
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")


async def _fetch_page(session: aiohttp.ClientSession, url: str) -> Optional[str]:
    """Fetch a page with polite headers."""
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; DroneResearchBot/1.0; academic-outreach)",
        "Accept": "text/html,application/xhtml+xml",
    }
    try:
        async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=20),
                               allow_redirects=True) as resp:
            if resp.status != 200:
                logger.warning("HTTP %d for %s", resp.status, url)
                return None
            return await resp.text()
    except Exception as e:
        logger.error("Fetch error for %s: %s", url, e)
        return None


def _extract_faculty_from_html(html: str, base_url: str) -> list[dict]:
    """
    Extract faculty info from a department page.
    Returns list of {name, title, email, research, profile_url, lab_url}.
    """
    soup = BeautifulSoup(html, "html.parser")
    faculty = []

    # Strategy 1: Look for structured person cards (common patterns)
    for card in soup.select(
        ".person-card, .faculty-card, .views-row, .people-listing, "
        ".faculty-member, article.person, .profile-card, .member-item, "
        ".field-items .field-item, li.faculty"
    ):
        person = _parse_person_card(card, base_url)
        if person and person.get("name"):
            faculty.append(person)

    # Strategy 2: If no cards found, try table rows
    if not faculty:
        for row in soup.select("table tr, .directory-row"):
            person = _parse_table_row(row, base_url)
            if person and person.get("name"):
                faculty.append(person)

    # Strategy 3: Look for heading + description blocks
    if not faculty:
        for heading in soup.select("h2, h3, h4"):
            name_text = heading.get_text(strip=True)
            # Skip non-name headings
            if len(name_text) > 60 or len(name_text) < 4:
                continue
            if any(kw in name_text.lower() for kw in ("department", "directory", "faculty", "staff", "about")):
                continue

            person = {"name": name_text}

            # Look at siblings for info
            sibling = heading.find_next_sibling()
            if sibling:
                text = sibling.get_text(" ", strip=True)
                emails = EMAIL_RE.findall(text)
                if emails:
                    person["email"] = emails[0]

                # Check for research interests
                if "research" in text.lower():
                    person["research"] = text[:500]

            # Check for link to profile
            link = heading.find("a")
            if link and link.get("href"):
                person["profile_url"] = urljoin(base_url, link["href"])

            faculty.append(person)

    return faculty


def _parse_person_card(card, base_url: str) -> dict:
    """Parse a person card/div element."""
    person = {}

    # Name: look in h2/h3/h4/a.name or first strong/b
    name_el = card.select_one("h2 a, h3 a, h4 a, .name a, a.name, h2, h3, h4, .field-name")
    if name_el:
        person["name"] = name_el.get_text(strip=True)
        if name_el.name == "a" and name_el.get("href"):
            person["profile_url"] = urljoin(base_url, name_el["href"])

    # Title
    title_el = card.select_one(".title, .position, .job-title, .field-title")
    if title_el:
        person["title"] = title_el.get_text(strip=True)

    # Email
    email_el = card.select_one("a[href^='mailto:']")
    if email_el:
        person["email"] = email_el["href"].replace("mailto:", "").strip()
    else:
        text = card.get_text(" ", strip=True)
        emails = EMAIL_RE.findall(text)
        if emails:
            person["email"] = emails[0]

    # Research interests
    research_el = card.select_one(".research, .interests, .field-research, .expertise")
    if research_el:
        person["research"] = research_el.get_text(" ", strip=True)[:500]

    return person


def _parse_table_row(row, base_url: str) -> dict:
    """Parse a table row for faculty info."""
    cells = row.select("td, th")
    if len(cells) < 2:
        return {}

    person = {"name": cells[0].get_text(strip=True)}

    link = cells[0].find("a")
    if link and link.get("href"):
        person["profile_url"] = urljoin(base_url, link["href"])

    for cell in cells[1:]:
        text = cell.get_text(strip=True)
        emails = EMAIL_RE.findall(text)
        if emails:
            person["email"] = emails[0]
        elif "professor" in text.lower() or "lecturer" in text.lower():
            person["title"] = text

    return person


def _is_drone_relevant(person: dict) -> bool:
    """Check if a faculty member's research is drone-related."""
    text = " ".join([
        person.get("research", ""),
        person.get("name", ""),
        " ".join(person.get("research_areas", [])),
    ]).lower()

    return any(kw in text for kw in DRONE_KEYWORDS)


async def _crawl_department(
    http: aiohttp.ClientSession,
    db: AsyncSession,
    university: str,
    department: str,
    url: str,
    batch: DiscoveryBatch,
) -> int:
    """Crawl a single department faculty page."""
    html = await _fetch_page(http, url)
    if not html:
        return 0

    faculty_list = _extract_faculty_from_html(html, url)
    new_count = 0

    for person in faculty_list:
        name = person.get("name", "").strip()
        if not name or len(name) < 3:
            continue

        # Check for existing by email or name+org
        if person.get("email"):
            existing = await db.execute(
                select(DroneProspect).where(DroneProspect.email == person["email"])
            )
            if existing.scalar_one_or_none():
                batch.prospects_found += 1
                continue

        existing = await db.execute(
            select(DroneProspect).where(
                DroneProspect.name == name,
                DroneProspect.organization == university,
            )
        )
        if existing.scalar_one_or_none():
            batch.prospects_found += 1
            continue

        # Parse research areas from text
        research_text = person.get("research", "")
        research_areas = [
            kw for kw in DRONE_KEYWORDS
            if kw in research_text.lower()
        ] if research_text else []

        prospect = DroneProspect(
            id=uuid4(),
            name=name,
            title=person.get("title", "Professor"),
            department=department,
            organization=university,
            organization_type="university",
            email=person.get("email"),
            personal_site=person.get("profile_url"),
            research_areas=research_areas or None,
            source="faculty_page",
            source_url=url,
            discovery_batch_id=batch.id,
            status="discovered",
        )

        db.add(prospect)
        new_count += 1
        batch.prospects_found += 1
        batch.prospects_new += 1

        logger.info("Faculty: %s @ %s %s", name, university, department)

    return new_count


async def crawl_faculty_pages(universities: Optional[list[tuple]] = None) -> dict:
    """
    Crawl university faculty pages to discover drone-relevant professors.

    Args:
        universities: List of (university, department, url) tuples.
                     Defaults to TARGET_DEPARTMENTS.

    Returns:
        {"batch_id": str, "found": int, "new": int}
    """
    targets = universities or TARGET_DEPARTMENTS

    async with async_session_factory() as db:
        batch = DiscoveryBatch(
            id=uuid4(),
            source="faculty_page",
            query=f"{len(targets)} departments",
            status="running",
            started_at=datetime.now(timezone.utc),
        )
        db.add(batch)
        await db.flush()

        total_new = 0

        async with aiohttp.ClientSession() as http:
            for university, department, url in targets:
                logger.info("Crawling %s — %s", university, department)
                n = await _crawl_department(http, db, university, department, url, batch)
                total_new += n
                await db.flush()
                await asyncio.sleep(3)  # polite: 3s between departments

        batch.status = "complete"
        batch.completed_at = datetime.now(timezone.utc)
        await db.commit()

        logger.info(
            "Faculty crawl complete: found=%d, new=%d",
            batch.prospects_found, batch.prospects_new,
        )
        return {
            "batch_id": str(batch.id),
            "found": batch.prospects_found,
            "new": batch.prospects_new,
        }
