"""
arXiv Crawler — Discover researchers publishing drone/UAV/SLAM/FPGA papers.

Uses the arXiv public API (Atom feed) to find recent papers on
drone-related topics, extracts author names and affiliations,
and creates DroneProspect records.

arXiv API docs: https://info.arxiv.org/help/api/index.html
Rate limit: 1 request per 3 seconds (we respect this).
"""

import asyncio
import logging
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

import aiohttp
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import async_session_factory
from api.models.prospect import DiscoveryBatch, DroneProspect

logger = logging.getLogger("drone.arxiv_crawler")

# arXiv category + keyword search queries
ARXIV_QUERIES = [
    # Original 10
    "cat:cs.RO AND (drone OR UAV OR unmanned aerial)",
    "cat:cs.RO AND (SLAM AND aerial)",
    "cat:cs.RO AND (quadrotor OR multirotor) AND (control OR planning)",
    "cat:cs.RO AND (swarm AND unmanned)",
    "cat:eess.SP AND (drone OR UAV) AND (FPGA OR embedded)",
    "cat:cs.CV AND (aerial AND autonomous AND navigation)",
    "cat:cs.SY AND (flight controller OR PX4 OR ArduPilot)",
    "cat:cs.RO AND (LiDAR AND aerial AND mapping)",
    "cat:cs.AI AND (drone AND reinforcement learning)",
    "cat:eess.SP AND (radar AND UAV AND detection)",
    # Expanded — deeper niches
    "cat:cs.RO AND (motion planning AND aerial AND obstacle)",
    "cat:cs.RO AND (visual inertial AND odometry OR VINS)",
    "cat:cs.RO AND (collision avoidance AND UAV)",
    "cat:cs.RO AND (multi-agent AND UAV OR drone)",
    "cat:cs.CV AND (semantic segmentation AND aerial)",
    "cat:cs.CV AND (object detection AND drone OR UAV)",
    "cat:cs.RO AND (sim-to-real AND aerial OR quadrotor)",
    "cat:cs.SY AND (model predictive control AND quadrotor)",
    "cat:cs.RO AND (exploration AND aerial AND unknown)",
    "cat:cs.RO AND (cooperative AND multi-UAV)",
    "cat:eess.SP AND (signal processing AND unmanned aerial)",
    "cat:cs.RO AND (manipulation AND aerial OR flying)",
    "cat:cs.RO AND (landing AND autonomous AND aerial)",
    "cat:cs.RO AND (payload AND delivery AND drone)",
    "cat:cs.NE AND (evolutionary AND UAV OR drone)",
]

# Track offsets per query for pagination across runs
_query_offsets: dict[str, int] = {}

ARXIV_API = "http://export.arxiv.org/api/query"
RESULTS_PER_QUERY = 30
DELAY_BETWEEN_REQUESTS = 3.5  # arXiv wants >= 3s between requests

# Namespaces for parsing Atom XML
NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "arxiv": "http://arxiv.org/schemas/atom",
}

# Keywords for filtering drone-relevant papers
DRONE_KEYWORDS = {
    "uav", "drone", "unmanned aerial", "quadrotor", "multirotor",
    "slam", "autonomous navigation", "path planning", "px4",
    "ardupilot", "fpga", "flight controller", "aerial robot",
    "lidar", "swarm", "edge computing", "ros2", "gazebo",
    "computer vision", "sensor fusion", "remote sensing", "visual odometry",
}

RESEARCH_AREA_MAP = {
    "SLAM": ["slam", "simultaneous localization", "visual odometry"],
    "Path Planning": ["path planning", "motion planning", "trajectory"],
    "Swarm": ["swarm", "multi-agent", "multi-robot", "formation"],
    "Computer Vision": ["computer vision", "object detection", "image"],
    "Sensor Fusion": ["sensor fusion", "multi-sensor", "imu"],
    "FPGA": ["fpga", "hardware acceleration", "real-time processing"],
    "Edge Computing": ["edge computing", "embedded", "onboard"],
    "LiDAR": ["lidar", "point cloud", "3d mapping"],
    "Control Systems": ["control", "pid", "lqr", "mpc", "nonlinear"],
    "Autonomous Navigation": ["autonomous nav", "gps-denied", "obstacle avoidance"],
    "Deep Learning": ["deep learning", "neural network", "reinforcement learning", "cnn"],
    "Remote Sensing": ["remote sensing", "multispectral", "hyperspectral"],
    "ROS": ["ros", "ros2", "robot operating system"],
}


def _extract_research_areas(title: str, summary: str) -> list[str]:
    """Map paper title + abstract to research area tags."""
    text = f"{title} {summary}".lower()
    areas = []
    for area, keywords in RESEARCH_AREA_MAP.items():
        if any(kw in text for kw in keywords):
            areas.append(area)
    return areas


def _extract_affiliation(name_el: ET.Element) -> Optional[str]:
    """Extract affiliation from an arXiv author element (arxiv:affiliation)."""
    aff = name_el.find("arxiv:affiliation", NS)
    if aff is not None and aff.text:
        return aff.text.strip()
    return None


def _extract_university(affiliation: str) -> Optional[str]:
    """Extract university name from an affiliation string."""
    if not affiliation:
        return None
    # Split on commas and find the university-like part
    parts = [p.strip() for p in affiliation.split(",")]
    for part in parts:
        lower = part.lower()
        if any(kw in lower for kw in ("university", "institute", "college", "polytechnic",
                                       "école", "universität", "universidad")):
            return part
    return parts[-1] if parts else None


def _extract_department(affiliation: str) -> Optional[str]:
    """Extract department from affiliation string."""
    if not affiliation:
        return None
    parts = [p.strip() for p in affiliation.split(",")]
    for part in parts:
        lower = part.lower()
        if any(kw in lower for kw in ("department", "school", "faculty", "lab",
                                       "engineering", "computer science", "electrical",
                                       "mechanical", "aerospace", "robotics")):
            return part
    return None


def _parse_entry(entry: ET.Element) -> list[dict]:
    """Parse a single arXiv entry into prospect dicts (one per author)."""
    title_el = entry.find("atom:title", NS)
    summary_el = entry.find("atom:summary", NS)
    published_el = entry.find("atom:published", NS)
    link_el = entry.find("atom:id", NS)

    title = title_el.text.strip().replace("\n", " ") if title_el is not None and title_el.text else ""
    summary = summary_el.text.strip().replace("\n", " ") if summary_el is not None and summary_el.text else ""
    arxiv_url = link_el.text.strip() if link_el is not None and link_el.text else ""
    pub_year = None
    if published_el is not None and published_el.text:
        try:
            pub_year = int(published_el.text[:4])
        except (ValueError, IndexError):
            pass

    # Check if paper is drone-relevant (query may not perfectly filter)
    full_text = f"{title} {summary}".lower()
    if not any(kw in full_text for kw in DRONE_KEYWORDS):
        return []

    research_areas = _extract_research_areas(title, summary)

    authors = entry.findall("atom:author", NS)
    results = []
    for author_el in authors:
        name_el = author_el.find("atom:name", NS)
        if name_el is None or not name_el.text:
            continue

        name = name_el.text.strip()
        affiliation = _extract_affiliation(author_el)
        university = _extract_university(affiliation)
        department = _extract_department(affiliation)

        results.append({
            "name": name,
            "organization": university or affiliation or "",
            "department": department,
            "research_areas": research_areas,
            "recent_paper": {
                "title": title,
                "year": pub_year,
                "venue": "arXiv",
                "url": arxiv_url,
            },
            "source_url": arxiv_url,
        })

    return results


async def _search_arxiv(
    session: aiohttp.ClientSession,
    query: str,
    max_results: int = RESULTS_PER_QUERY,
    start: int = 0,
) -> str:
    """Query arXiv API and return raw XML response."""
    params = {
        "search_query": query,
        "start": start,
        "max_results": max_results,
        "sortBy": "submittedDate",
        "sortOrder": "descending",
    }
    try:
        async with session.get(
            ARXIV_API,
            params=params,
            timeout=aiohttp.ClientTimeout(total=30),
        ) as resp:
            if resp.status != 200:
                logger.error("arXiv API error: %d for query '%s'", resp.status, query)
                return ""
            return await resp.text()
    except Exception as e:
        logger.error("arXiv API exception for '%s': %s", query, e)
        return ""


async def discover_arxiv_prospects() -> dict:
    """
    Main discovery function — crawl arXiv for drone-related papers
    and create DroneProspect records for authors.

    Returns: {"batch_id": str, "found": int, "new": int}
    """
    async with async_session_factory() as db:
        batch = DiscoveryBatch(
            id=uuid4(),
            source="arxiv",
            query="drone_uav_research",
            status="running",
            started_at=datetime.now(timezone.utc),
        )
        db.add(batch)
        await db.commit()

        found = 0
        new = 0

        try:
            async with aiohttp.ClientSession() as http:
                for query in ARXIV_QUERIES:
                    offset = _query_offsets.get(query, 0)
                    logger.info("arXiv query: %s (offset=%d)", query, offset)
                    xml_text = await _search_arxiv(http, query, start=offset)
                    if not xml_text:
                        await asyncio.sleep(DELAY_BETWEEN_REQUESTS)
                        continue

                    try:
                        root = ET.fromstring(xml_text)
                    except ET.ParseError as e:
                        logger.error("XML parse error for query '%s': %s", query, e)
                        await asyncio.sleep(DELAY_BETWEEN_REQUESTS)
                        continue

                    entries = root.findall("atom:entry", NS)
                    for entry in entries:
                        prospects = _parse_entry(entry)
                        found += len(prospects)

                        for p_data in prospects:
                            # Skip if no organization (can't identify them)
                            if not p_data["organization"]:
                                continue

                            # Dedup: check by name + organization
                            existing = await db.execute(
                                select(DroneProspect).where(
                                    DroneProspect.name == p_data["name"],
                                    DroneProspect.organization == p_data["organization"],
                                )
                            )
                            if existing.scalar_one_or_none():
                                continue

                            prospect = DroneProspect(
                                id=uuid4(),
                                name=p_data["name"],
                                title="Researcher",
                                department=p_data.get("department"),
                                organization=p_data["organization"],
                                organization_type="university",
                                research_areas=p_data.get("research_areas", []),
                                recent_papers=[p_data["recent_paper"]],
                                source="arxiv",
                                source_url=p_data.get("source_url"),
                                status="discovered",
                            )
                            db.add(prospect)
                            new += 1

                    await db.commit()
                    # Advance offset for next run to discover deeper results
                    _query_offsets[query] = offset + RESULTS_PER_QUERY
                    # Reset offset if it gets too deep (cycle back)
                    if _query_offsets[query] >= 300:
                        _query_offsets[query] = 0
                    # Respect arXiv rate limit
                    await asyncio.sleep(DELAY_BETWEEN_REQUESTS)

            batch.status = "completed"
            batch.prospects_found = found
            batch.prospects_new = new
            batch.completed_at = datetime.now(timezone.utc)

        except Exception as e:
            logger.exception("arXiv crawler error: %s", e)
            batch.status = "error"
            batch.error_message = str(e)[:500]

        await db.commit()

        result = {
            "batch_id": str(batch.id),
            "found": found,
            "new": new,
        }
        logger.info("arXiv crawl complete: %s", result)
        return result
