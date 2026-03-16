"""
NSF Award Crawler — Discover professors with active drone/UAV grants.

Queries the NSF Award Search API to find funded research projects related
to drones, UAVs, autonomous systems, etc. Extracts PI names, institutions,
grant amounts, and creates DroneProspect records.

This is the highest-signal discovery source because:
1. A funded grant = confirmed budget exists
2. PI details are public (name, institution, email often available)
3. Award abstracts reveal exact research focus
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

import aiohttp
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.config import settings
from api.database import async_session_factory
from api.models.prospect import DiscoveryBatch, DroneProspect

logger = logging.getLogger("drone.nsf_crawler")

# NSF search queries covering drone-adjacent topics
NSF_QUERIES = [
    "unmanned aerial vehicle",
    "drone autonomous",
    "UAV navigation",
    "quadrotor control",
    "aerial robotics",
    "FPGA drone",
    "sUAS remote sensing",
    "flight controller embedded",
    "swarm unmanned",
    "LiDAR aerial mapping",
    "visual SLAM aerial",
    "PX4 ArduPilot",
]

# NSF program codes relevant to drone research
DRONE_PROGRAM_CODES = [
    "7918",  # Cyber Physical Systems
    "7495",  # Robust Intelligence
    "1517",  # EPMD (Engineering for Natural Hazards)
    "7607",  # Power, Controls, and Adaptive Networks
    "7569",  # Dynamics, Control and System Diagnostics
    "1443",  # Fluid Dynamics
]


async def _search_nsf(
    session: aiohttp.ClientSession,
    keyword: str,
    offset: int = 1,
    limit: int = 25,
) -> list[dict]:
    """Query NSF Award Search API. Returns list of award dicts."""
    params = {
        "keyword": keyword,
        "printFields": (
            "id,title,abstractText,piFirstName,piLastName,piEmail,"
            "pdPIName,awardeeName,awardeeCity,awardeeStateCode,"
            "fundsObligatedAmt,startDate,expDate,fundProgramName,"
            "primaryProgram,awardeeCountryCode"
        ),
        "offset": offset,
        "rpp": limit,
        # Only active awards
        "expired": "false",
    }

    try:
        async with session.get(
            settings.nsf_api_base,
            params=params,
            timeout=aiohttp.ClientTimeout(total=30),
        ) as resp:
            if resp.status != 200:
                logger.error("NSF API error: %d", resp.status)
                return []
            data = await resp.json()
            return data.get("response", {}).get("award", [])
    except Exception as e:
        logger.error("NSF API exception: %s", e)
        return []


def _parse_research_areas(abstract: str) -> list[str]:
    """Extract drone-relevant research areas from an NSF abstract."""
    areas = []
    abstract_lower = (abstract or "").lower()

    keywords_map = {
        "SLAM": ["slam", "simultaneous localization"],
        "Path Planning": ["path planning", "motion planning", "trajectory"],
        "Swarm": ["swarm", "multi-agent", "multi-robot", "cooperative"],
        "Computer Vision": ["computer vision", "visual", "image processing"],
        "Sensor Fusion": ["sensor fusion", "multi-sensor", "data fusion"],
        "FPGA": ["fpga", "field programmable"],
        "Edge Computing": ["edge computing", "embedded computing", "on-board processing"],
        "LiDAR": ["lidar", "laser scanning", "point cloud"],
        "Control Systems": ["control system", "flight control", "autopilot"],
        "Autonomous Navigation": ["autonomous", "navigation", "self-driving"],
        "Remote Sensing": ["remote sensing", "aerial survey", "photogrammetry"],
        "Deep Learning": ["deep learning", "neural network", "machine learning"],
        "ROS": ["ros ", "robot operating system"],
        "Inspection": ["inspection", "infrastructure monitoring"],
    }

    for area, keywords in keywords_map.items():
        if any(kw in abstract_lower for kw in keywords):
            areas.append(area)

    return areas


async def _process_awards(
    db: AsyncSession,
    awards: list[dict],
    batch: DiscoveryBatch,
    query: str,
) -> int:
    """Process NSF awards and create/update prospect records."""
    new_count = 0

    for award in awards:
        pi_first = (award.get("piFirstName") or "").strip()
        pi_last = (award.get("piLastName") or "").strip()
        pi_email = (award.get("piEmail") or "").strip()
        pi_name = f"{pi_first} {pi_last}".strip()
        institution = (award.get("awardeeName") or "").strip()

        if not pi_name or not institution:
            continue

        # Check for duplicate by email or name+org
        if pi_email:
            existing = await db.execute(
                select(DroneProspect).where(DroneProspect.email == pi_email)
            )
            existing = existing.scalar_one_or_none()
            if existing:
                # Update grant info on existing prospect
                grants = existing.active_grants or []
                award_id = award.get("id", "")
                if not any(g.get("award_id") == award_id for g in grants):
                    grants.append({
                        "agency": "NSF",
                        "title": award.get("title", ""),
                        "amount": int(award.get("fundsObligatedAmt", 0) or 0),
                        "start_year": _parse_year(award.get("startDate")),
                        "end_year": _parse_year(award.get("expDate")),
                        "award_id": award_id,
                    })
                    existing.active_grants = grants
                    existing.total_grant_funding = sum(g.get("amount", 0) for g in grants)
                batch.prospects_found += 1
                continue

        existing = await db.execute(
            select(DroneProspect).where(
                DroneProspect.name == pi_name,
                DroneProspect.organization == institution,
            )
        )
        if existing.scalar_one_or_none():
            batch.prospects_found += 1
            continue

        # Parse grant info
        amount = int(award.get("fundsObligatedAmt", 0) or 0)
        grant = {
            "agency": "NSF",
            "title": award.get("title", ""),
            "amount": amount,
            "start_year": _parse_year(award.get("startDate")),
            "end_year": _parse_year(award.get("expDate")),
            "award_id": award.get("id", ""),
            "program": award.get("primaryProgram", ""),
        }

        # Parse research areas from abstract
        abstract = award.get("abstractText", "")
        research_areas = _parse_research_areas(abstract)

        prospect = DroneProspect(
            id=uuid4(),
            name=pi_name,
            title="Principal Investigator",
            organization=institution,
            organization_type="university",
            email=pi_email or None,
            city=award.get("awardeeCity"),
            state=award.get("awardeeStateCode"),
            country=award.get("awardeeCountryCode", "US"),
            research_areas=research_areas or None,
            active_grants=[grant],
            total_grant_funding=amount,
            grant_agencies=["NSF"],
            source="nsf",
            source_url=f"https://www.nsf.gov/awardsearch/showAward?AWD_ID={award.get('id', '')}",
            discovery_batch_id=batch.id,
            status="discovered",
        )

        db.add(prospect)
        new_count += 1
        batch.prospects_found += 1
        batch.prospects_new += 1

        logger.info(
            "NSF Award: %s @ %s — $%s (%s)",
            pi_name, institution, f"{amount:,}", award.get("title", "")[:60],
        )

    return new_count


def _parse_year(date_str: Optional[str]) -> Optional[int]:
    """Parse year from NSF date format (MM/DD/YYYY)."""
    if not date_str:
        return None
    try:
        parts = date_str.split("/")
        if len(parts) == 3:
            return int(parts[2])
    except (ValueError, IndexError):
        pass
    return None


async def crawl_nsf(query: Optional[str] = None, max_results: int = 100) -> dict:
    """
    Run an NSF Award Search discovery crawl.

    Args:
        query: Specific search query (or None to use all NSF_QUERIES)
        max_results: Max results per query

    Returns:
        {"batch_id": str, "found": int, "new": int}
    """
    queries = [query] if query else NSF_QUERIES

    async with async_session_factory() as db:
        batch = DiscoveryBatch(
            id=uuid4(),
            source="nsf",
            query=", ".join(queries[:3]),
            status="running",
            started_at=datetime.now(timezone.utc),
        )
        db.add(batch)
        await db.flush()

        total_new = 0

        async with aiohttp.ClientSession() as http:
            for q in queries:
                awards = await _search_nsf(http, q, limit=min(max_results, 25))
                if awards:
                    n = await _process_awards(db, awards, batch, q)
                    total_new += n
                    await db.flush()

                await asyncio.sleep(1)  # polite delay

        batch.status = "complete"
        batch.completed_at = datetime.now(timezone.utc)
        await db.commit()

        logger.info(
            "NSF crawl complete: found=%d, new=%d",
            batch.prospects_found, batch.prospects_new,
        )
        return {
            "batch_id": str(batch.id),
            "found": batch.prospects_found,
            "new": batch.prospects_new,
        }
