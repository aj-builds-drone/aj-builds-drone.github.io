"""
Google Scholar Crawler — Discover professors publishing drone/UAV/SLAM/FPGA papers.

Uses the `scholarly` library to scrape Google Scholar directly (no API key needed).
Finds authors, extracts profiles, and creates DroneProspect records with research data.

Discovery sources:
- Google Scholar search for drone-related keywords
- Author profile extraction (h-index, papers, affiliations)
"""

import asyncio
import logging
import random
import re
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.config import settings
from api.database import async_session_factory
from api.models.prospect import DiscoveryBatch, DroneProspect

logger = logging.getLogger("drone.scholar_crawler")

# Drone-related search queries
SCHOLAR_QUERIES = [
    # Original 15
    "UAV autonomous navigation",
    "drone SLAM visual odometry",
    "PX4 flight controller research",
    "ArduPilot custom firmware",
    "FPGA drone real-time processing",
    "quadrotor control deep learning",
    "drone swarm coordination",
    "unmanned aerial vehicle path planning",
    "LiDAR drone 3D mapping",
    "drone multispectral remote sensing",
    "sUAS urban air mobility",
    "drone computer vision edge computing",
    "ROS2 aerial robotics",
    "drone payload integration sensor fusion",
    "autonomous drone inspection infrastructure",
    # Expanded — new discovery topics
    "UAV FPGA embedded acceleration",
    "drone sim-to-real transfer learning",
    "visual inertial navigation micro aerial vehicle",
    "cooperative multi-UAV task allocation",
    "drone delivery last mile logistics",
    "UAV wind estimation disturbance rejection",
    "agile quadrotor racing FPV",
    "counter-UAS detection classification",
    "drone beyond visual line of sight BVLOS",
    "vertical takeoff landing eVTOL",
    "aerial manipulation grasping UAV",
    "semantic mapping aerial robot",
    "model predictive control quadrotor trajectory",
    "UAV bridge inspection structural health",
    "precision agriculture drone multispectral",
]

# Daily call tracking (raised to 500 — scholarly is free)
DAILY_LIMIT = 500
_daily_calls = 0
_daily_date = ""


def _check_daily_limit() -> bool:
    global _daily_calls, _daily_date
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if _daily_date != today:
        _daily_calls = 0
        _daily_date = today
    if _daily_calls >= DAILY_LIMIT:
        logger.warning("Scholar daily limit reached (%d/%d)", _daily_calls, DAILY_LIMIT)
        return False
    return True


def _increment_call():
    global _daily_calls, _daily_date
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if _daily_date != today:
        _daily_calls = 0
        _daily_date = today
    _daily_calls += 1


def _extract_university(affiliation: str) -> Optional[str]:
    """Extract university name from affiliation string like 'Professor, MIT'."""
    if not affiliation:
        return None
    parts = [p.strip() for p in affiliation.split(",")]
    for part in parts:
        lower = part.lower()
        if any(kw in lower for kw in ("university", "institute", "college", "polytechnic", "school of")):
            return part
    return parts[-1] if parts else None


def _extract_department(affiliation: str) -> Optional[str]:
    """Extract department from affiliation string."""
    if not affiliation:
        return None
    parts = [p.strip() for p in affiliation.split(",")]
    for part in parts:
        lower = part.lower()
        if any(kw in lower for kw in ("department", "school", "faculty", "engineering", "computer science",
                                       "mechanical", "electrical", "aerospace")):
            return part
    return None


def _parse_research_areas(interests: list[str]) -> list[str]:
    """Normalize scholar interest tags into our research_areas format."""
    drone_keywords = {
        "uav", "drone", "unmanned", "quadrotor", "multirotor", "aerial",
        "slam", "visual odometry", "path planning", "swarm", "autonomy",
        "fpga", "embedded", "real-time", "edge computing",
        "ros", "px4", "ardupilot", "flight controller",
        "lidar", "computer vision", "perception", "sensor fusion",
        "control", "navigation", "localization", "mapping",
    }
    areas = []
    for interest in (interests or []):
        interest_lower = interest.lower()
        if any(kw in interest_lower for kw in drone_keywords):
            areas.append(interest)
    return areas or interests[:5]


# ---------------------------------------------------------------------------
# scholarly wrappers (synchronous lib → asyncio.to_thread)
# ---------------------------------------------------------------------------

def _scholarly_search_pubs(query: str, year_low: int, max_results: int = 10) -> list[dict]:
    """Synchronous: search Google Scholar publications via scholarly."""
    from scholarly import scholarly
    import time

    results = []
    try:
        search_gen = scholarly.search_pubs(query, year_low=year_low)
        for i, pub in enumerate(search_gen):
            if i >= max_results:
                break
            results.append(pub)
            time.sleep(random.uniform(1.0, 2.0))  # polite delay between iterations
    except Exception as e:
        logger.error("scholarly search_pubs error for %r: %s", query, e)
    return results


def _scholarly_get_author(author_name: str) -> Optional[dict]:
    """Synchronous: search for an author by name and fill their profile."""
    from scholarly import scholarly
    import time

    try:
        search = scholarly.search_author(author_name)
        author = next(search, None)
        if author is None:
            return None
        time.sleep(random.uniform(2.0, 4.0))
        filled = scholarly.fill(author, sections=["basics", "indices", "publications"])
        return filled
    except StopIteration:
        return None
    except Exception as e:
        logger.warning("scholarly author lookup error for %r: %s", author_name, e)
        return None


async def _search_scholar_pubs(query: str, start: int = 0) -> list[dict]:
    """Search Google Scholar via scholarly (async wrapper)."""
    if not _check_daily_limit():
        return []
    _increment_call()

    year_low = datetime.now().year - 3
    try:
        results = await asyncio.to_thread(_scholarly_search_pubs, query, year_low, max_results=10)
        return results
    except Exception as e:
        logger.error("Scholar search exception: %s", e)
        return []


async def _get_author_profile(author_name: str) -> Optional[dict]:
    """Get detailed author profile from scholarly (async wrapper)."""
    if not _check_daily_limit():
        return None
    _increment_call()

    try:
        profile = await asyncio.to_thread(_scholarly_get_author, author_name)
        return profile
    except Exception as e:
        logger.error("Author profile exception: %s", e)
        return None


def _extract_author_id_from_profile(profile: dict) -> Optional[str]:
    """Extract Google Scholar author ID from a scholarly profile dict."""
    return profile.get("scholar_id") or profile.get("author_id")


async def _process_search_results(
    db: AsyncSession,
    results: list[dict],
    batch: DiscoveryBatch,
) -> int:
    """Process scholarly search results, extract authors, create prospect records."""
    new_count = 0

    for pub in results:
        bib = pub.get("bib", {})
        author_names = bib.get("author", [])
        if isinstance(author_names, str):
            author_names = [a.strip() for a in author_names.split(" and ")]

        pub_url = pub.get("pub_url") or pub.get("eprint_url") or ""

        for author_name in author_names:
            author_name = author_name.strip()
            if not author_name or len(author_name) < 3:
                continue

            # Check for duplicate by name
            existing = await db.execute(
                select(DroneProspect).where(DroneProspect.name == author_name)
            )
            existing = existing.scalar_one_or_none()
            if existing:
                batch.prospects_found += 1
                continue

            # Get detailed profile
            profile = await _get_author_profile(author_name)
            await asyncio.sleep(random.uniform(3.0, 5.0))  # polite delay

            affiliation = ""
            interests = []
            h_index = None
            total_citations = None
            scholar_url = None
            recent_papers = []

            if profile:
                affiliation = profile.get("affiliation", "")
                interests = [i if isinstance(i, str) else i.get("title", "") for i in (profile.get("interests") or [])]
                scholar_id = _extract_author_id_from_profile(profile)
                if scholar_id:
                    scholar_url = f"https://scholar.google.com/citations?user={scholar_id}"

                # Check duplicate by scholar_url too
                if scholar_url:
                    dup = await db.execute(
                        select(DroneProspect).where(DroneProspect.scholar_url == scholar_url)
                    )
                    if dup.scalar_one_or_none():
                        batch.prospects_found += 1
                        continue

                h_index = profile.get("hindex") or profile.get("citedby", None)
                # scholarly stores indices in different ways
                if isinstance(h_index, dict):
                    h_index = h_index.get("all") or h_index.get("5y")
                total_citations = profile.get("citedby") if isinstance(profile.get("citedby"), int) else None

                # Extract recent papers from filled publications
                for article in (profile.get("publications") or [])[:10]:
                    a_bib = article.get("bib", {})
                    recent_papers.append({
                        "title": a_bib.get("title", ""),
                        "year": str(a_bib.get("pub_year", "")),
                        "citation_count": article.get("num_citations", 0),
                        "url": article.get("pub_url") or article.get("eprint_url") or "",
                    })

            university = _extract_university(affiliation)
            department = _extract_department(affiliation)
            if not university:
                university = affiliation or "Unknown"

            research_areas = _parse_research_areas(interests)

            prospect = DroneProspect(
                id=uuid4(),
                name=author_name,
                title="Professor",
                department=department,
                organization=university,
                organization_type="university",
                scholar_url=scholar_url,
                research_areas=research_areas,
                recent_papers=recent_papers,
                h_index=h_index,
                total_citations=total_citations,
                source="google_scholar",
                source_url=pub_url,
                discovery_batch_id=batch.id,
                status="discovered",
            )

            db.add(prospect)
            new_count += 1
            batch.prospects_found += 1
            batch.prospects_new += 1

            logger.info("Discovered: %s @ %s (h=%s)", author_name, university, h_index)

    return new_count


async def crawl_scholar(query: Optional[str] = None, max_pages: int = 5) -> dict:
    """
    Run a Google Scholar discovery crawl.

    Args:
        query: Specific search query (or None to use all SCHOLAR_QUERIES)
        max_pages: Max result pages per query (10 results each)

    Returns:
        {"batch_id": str, "found": int, "new": int}
    """
    queries = [query] if query else SCHOLAR_QUERIES

    async with async_session_factory() as db:
        batch = DiscoveryBatch(
            id=uuid4(),
            source="google_scholar",
            query=", ".join(queries[:3]),
            status="running",
            started_at=datetime.now(timezone.utc),
        )
        db.add(batch)
        await db.flush()

        total_new = 0

        for q in queries:
            if not _check_daily_limit():
                break

            for page in range(max_pages):
                results = await _search_scholar_pubs(q, start=page * 10)
                if not results:
                    break

                n = await _process_search_results(db, results, batch)
                total_new += n
                await db.flush()

                await asyncio.sleep(random.uniform(3.0, 5.0))  # polite delay between pages

            await asyncio.sleep(random.uniform(5.0, 8.0))  # delay between queries

        batch.status = "complete"
        batch.completed_at = datetime.now(timezone.utc)
        await db.commit()

        logger.info(
            "Scholar crawl complete: found=%d, new=%d",
            batch.prospects_found, batch.prospects_new,
        )
        return {
            "batch_id": str(batch.id),
            "found": batch.prospects_found,
            "new": batch.prospects_new,
        }
