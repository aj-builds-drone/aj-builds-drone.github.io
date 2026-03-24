"""
Google Scholar Crawler — Discover professors publishing drone/UAV/SLAM/FPGA papers.

Uses SerpAPI (Google Scholar endpoint) to find authors, extract profiles,
and create DroneProspect records with research data.

Discovery sources:
- Google Scholar search for drone-related keywords
- Author profile extraction (h-index, papers, affiliations)
"""

import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

import aiohttp
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

SERPAPI_BASE = "https://serpapi.com/search"

# Daily call tracking
_daily_calls = 0
_daily_date = ""


def _check_daily_limit() -> bool:
    global _daily_calls, _daily_date
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if _daily_date != today:
        _daily_calls = 0
        _daily_date = today
    if _daily_calls >= settings.scholar_daily_limit:
        logger.warning("Scholar daily limit reached (%d/%d)", _daily_calls, settings.scholar_daily_limit)
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
    # Common patterns: "Department, University" or "University"
    parts = [p.strip() for p in affiliation.split(",")]
    # Look for part containing "university", "institute", "college", etc.
    for part in parts:
        lower = part.lower()
        if any(kw in lower for kw in ("university", "institute", "college", "polytechnic", "school of")):
            return part
    # If no match, return the last part (often the institution)
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
    return areas or interests[:5]  # fallback: first 5 interests


async def _search_scholar(
    session: aiohttp.ClientSession,
    query: str,
    start: int = 0,
) -> dict:
    """Search Google Scholar via SerpAPI."""
    if not _check_daily_limit():
        return {"organic_results": []}
    _increment_call()

    params = {
        "engine": "google_scholar",
        "q": query,
        "api_key": settings.serpapi_key,
        "start": start,
        "num": 10,
        "as_ylo": datetime.now().year - 3,  # last 3 years only
    }

    try:
        async with session.get(SERPAPI_BASE, params=params, timeout=aiohttp.ClientTimeout(total=30)) as resp:
            if resp.status == 429:
                logger.warning("Scholar API rate limited (429) — backing off 60s")
                await asyncio.sleep(60)
                return {"organic_results": []}
            if resp.status != 200:
                logger.error("Scholar API error: %d", resp.status)
                return {"organic_results": []}
            return await resp.json()
    except Exception as e:
        logger.error("Scholar API exception: %s", e)
        return {"organic_results": []}


async def _get_author_profile(
    session: aiohttp.ClientSession,
    author_id: str,
) -> dict:
    """Get detailed author profile from Google Scholar via SerpAPI."""
    if not _check_daily_limit():
        return {}
    _increment_call()

    params = {
        "engine": "google_scholar_author",
        "author_id": author_id,
        "api_key": settings.serpapi_key,
    }

    try:
        async with session.get(SERPAPI_BASE, params=params, timeout=aiohttp.ClientTimeout(total=30)) as resp:
            if resp.status != 200:
                return {}
            return await resp.json()
    except Exception as e:
        logger.error("Author profile API exception: %s", e)
        return {}


async def _process_search_results(
    http: aiohttp.ClientSession,
    db: AsyncSession,
    results: list[dict],
    batch: DiscoveryBatch,
) -> int:
    """Process search results, extract authors, create prospect records."""
    new_count = 0

    for result in results:
        # Extract authors from publication info
        pub_info = result.get("publication_info", {})
        authors_data = pub_info.get("authors", [])

        for author in authors_data:
            author_id = author.get("author_id")
            author_name = author.get("name", "").strip()

            if not author_name:
                continue

            # Check for duplicate by name+org (scholar_url if available)
            existing = None
            if author_id:
                scholar_url = f"https://scholar.google.com/citations?user={author_id}"
                existing = await db.execute(
                    select(DroneProspect).where(DroneProspect.scholar_url == scholar_url)
                )
                existing = existing.scalar_one_or_none()

            if existing:
                batch.prospects_found += 1
                continue

            # Get detailed profile
            profile = {}
            if author_id:
                profile = await _get_author_profile(http, author_id)
                await asyncio.sleep(1)  # rate limit

            author_info = profile.get("author", {})
            affiliation = author_info.get("affiliations", "")
            interests = [i.get("title", "") for i in author_info.get("interests", [])]

            university = _extract_university(affiliation)
            department = _extract_department(affiliation)

            if not university:
                university = affiliation or "Unknown"

            # Extract citation stats
            cited_by = profile.get("cited_by", {})
            h_index = None
            total_citations = None
            if cited_by:
                for table_entry in cited_by.get("table", []):
                    if table_entry.get("citations", {}).get("all") is not None:
                        total_citations = table_entry["citations"]["all"]
                    if table_entry.get("h_index", {}).get("all") is not None:
                        h_index = table_entry["h_index"]["all"]

            # Extract recent papers
            recent_papers = []
            for article in (profile.get("articles", []) or [])[:10]:
                recent_papers.append({
                    "title": article.get("title", ""),
                    "year": article.get("year", ""),
                    "citation_count": article.get("cited_by", {}).get("value", 0),
                    "url": article.get("link", ""),
                })

            research_areas = _parse_research_areas(interests)

            # Create prospect
            prospect = DroneProspect(
                id=uuid4(),
                name=author_name,
                title="Professor",
                department=department,
                organization=university,
                organization_type="university",
                scholar_url=f"https://scholar.google.com/citations?user={author_id}" if author_id else None,
                research_areas=research_areas,
                recent_papers=recent_papers,
                h_index=h_index,
                total_citations=total_citations,
                source="google_scholar",
                source_url=result.get("link", ""),
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
    if not settings.serpapi_key:
        logger.warning("No SerpAPI key configured — skipping Scholar crawl")
        return {"error": "No SerpAPI key configured"}

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

        async with aiohttp.ClientSession() as http:
            for q in queries:
                if not _check_daily_limit():
                    break

                for page in range(max_pages):
                    data = await _search_scholar(http, q, start=page * 10)
                    results = data.get("organic_results", [])
                    if not results:
                        break

                    n = await _process_search_results(http, db, results, batch)
                    total_new += n
                    await db.flush()

                    await asyncio.sleep(2)  # polite delay between pages

                await asyncio.sleep(5)  # delay between queries to avoid 429s

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
