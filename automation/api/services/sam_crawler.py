"""
SAM.gov Solicitation Monitor — Discover government drone contract opportunities.

Uses the SAM.gov public Opportunities API to find active solicitations
related to UAV/drone/UAS programs. Creates DroneProspect records for
government agencies seeking drone engineering services.

API docs: https://open.gsa.gov/api/get-opportunities-public-api/
Rate limit: Generous (public data, no key required).
"""

import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

import aiohttp
from sqlalchemy import select

from api.database import async_session_factory
from api.models.prospect import DiscoveryBatch, DroneProspect

logger = logging.getLogger("drone.sam_crawler")

SAM_API = "https://api.sam.gov/opportunities/v2/search"

# Drone/UAS-related search terms for SAM.gov
SAM_QUERIES = [
    "unmanned aerial system",
    "drone services UAS",
    "UAV engineering",
    "small unmanned aircraft",
    "counter UAS",
    "drone inspection survey",
    "autonomous aerial vehicle",
    "FPGA embedded avionics",
    "flight controller firmware",
    "aerial robotics research",
]

# NAICS codes relevant to drone work
DRONE_NAICS = {
    "334511": "Search, Detection, Navigation, Guidance, Aeronautical Systems",
    "336411": "Aircraft Manufacturing",
    "541330": "Engineering Services",
    "541715": "R&D in Physical, Engineering, and Life Sciences",
    "517919": "All Other Telecommunications (UAS comms)",
    "541990": "All Other Professional, Scientific, and Technical Services",
    "928110": "National Security",
}

DELAY_BETWEEN_REQUESTS = 2.0


def _extract_agency_name(org_hierarchy: str) -> str:
    """Extract the top-level agency name from SAM.gov org hierarchy."""
    if not org_hierarchy:
        return "U.S. Government"
    parts = org_hierarchy.split(".")
    return parts[0].strip() if parts else "U.S. Government"


def _extract_contact_email(data: dict) -> Optional[str]:
    """Extract primary contact email from SAM.gov opportunity."""
    poc = data.get("pointOfContact") or []
    if isinstance(poc, list):
        for contact in poc:
            email = contact.get("email")
            if email and "@" in email:
                return email
    return None


def _extract_contact_name(data: dict) -> Optional[str]:
    """Extract primary contact name from SAM.gov opportunity."""
    poc = data.get("pointOfContact") or []
    if isinstance(poc, list):
        for contact in poc:
            name = contact.get("fullName") or contact.get("title")
            if name:
                return name
    return None


async def crawl_sam_gov() -> dict:
    """
    Discover government drone-related solicitations from SAM.gov.

    Creates prospects for government agencies with active drone RFPs/RFQs.

    Returns: {batch_id, prospects_found, prospects_new, solicitations_scanned}
    """
    async with async_session_factory() as db:
        batch = DiscoveryBatch(
            id=uuid4(), source="sam_gov", query="drone UAS solicitations",
            status="running", started_at=datetime.now(timezone.utc),
        )
        db.add(batch)
        await db.commit()
        batch_id = str(batch.id)

    found = 0
    new = 0
    total_scanned = 0
    seen_notices = set()

    async with aiohttp.ClientSession() as http:
        for query in SAM_QUERIES:
            params = {
                "api_key": "",  # Public endpoint — no key needed for basic search
                "keyword": query,
                "postedFrom": _thirty_days_ago(),
                "limit": 25,
                "offset": 0,
            }
            try:
                async with http.get(SAM_API, params=params, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                    if resp.status != 200:
                        logger.warning("SAM.gov %d for query '%s'", resp.status, query)
                        await asyncio.sleep(DELAY_BETWEEN_REQUESTS)
                        continue
                    data = await resp.json()
            except Exception as e:
                logger.error("SAM.gov fetch error for '%s': %s", query, e)
                await asyncio.sleep(DELAY_BETWEEN_REQUESTS)
                continue

            opportunities = data.get("opportunitiesData") or []
            total_scanned += len(opportunities)

            for opp in opportunities:
                notice_id = opp.get("noticeId", "")
                if notice_id in seen_notices:
                    continue
                seen_notices.add(notice_id)

                title = opp.get("title", "")
                description = opp.get("description") or opp.get("additionalInfoLink") or ""
                agency = _extract_agency_name(opp.get("fullParentPathName", ""))
                sol_number = opp.get("solicitationNumber", "")
                deadline = opp.get("responseDeadLine")
                opp_type = opp.get("type", "")  # e.g., "Solicitation", "Presolicitation"
                naics = opp.get("naicsCode", "")
                set_aside = opp.get("typeOfSetAside", "")

                found += 1

                # Extract contact info
                contact_email = _extract_contact_email(opp)
                contact_name = _extract_contact_name(opp)

                async with async_session_factory() as db:
                    # Dedup by solicitation number (stored in notes)
                    if sol_number:
                        result = await db.execute(
                            select(DroneProspect.id).where(
                                DroneProspect.source == "sam_gov",
                                DroneProspect.notes.contains(sol_number),
                            ).limit(1)
                        )
                        if result.first():
                            continue

                    prospect = DroneProspect(
                        id=uuid4(),
                        name=contact_name or f"Contracting Officer — {agency}",
                        email=contact_email,
                        organization=agency,
                        organization_type="government",
                        title=f"{opp_type}: {title[:100]}",
                        department=opp.get("organizationType", ""),
                        status="discovered",
                        source="sam_gov",
                        source_url=f"https://sam.gov/opp/{notice_id}/view" if notice_id else None,
                        research_areas=_extract_topics(title, description),
                        enrichment={
                            "sol_number": sol_number,
                            "notice_id": notice_id,
                            "opp_type": opp_type,
                            "naics": naics,
                            "naics_desc": DRONE_NAICS.get(naics, ""),
                            "set_aside": set_aside,
                            "deadline": deadline,
                            "posted_date": opp.get("postedDate"),
                        },
                        notes=f"SAM.gov {opp_type}: {sol_number}\n{title}\nDeadline: {deadline}\nNAICS: {naics}",
                        discovery_batch_id=uuid4(),
                    )
                    db.add(prospect)
                    await db.commit()
                    new += 1

            await asyncio.sleep(DELAY_BETWEEN_REQUESTS)
            logger.info("SAM.gov: '%s' → %d opportunities", query, len(opportunities))

    # Finalize batch
    async with async_session_factory() as db:
        result = await db.execute(
            select(DiscoveryBatch).where(DiscoveryBatch.id == batch_id)
        )
        batch = result.scalar_one_or_none()
        if batch:
            batch.status = "completed"
            batch.completed_at = datetime.now(timezone.utc)
            batch.prospects_found = found
            batch.prospects_new = new
            await db.commit()

    logger.info("SAM.gov crawl complete: found=%d, new=%d, scanned=%d", found, new, total_scanned)
    return {"batch_id": batch_id, "prospects_found": found, "prospects_new": new, "solicitations_scanned": total_scanned}


def _thirty_days_ago() -> str:
    """Return MM/dd/yyyy of 30 days ago for SAM.gov date filter."""
    from datetime import timedelta
    d = datetime.now(timezone.utc) - timedelta(days=30)
    return d.strftime("%m/%d/%Y")


def _extract_topics(title: str, description: str) -> list[str]:
    """Extract drone-related research/capability areas from text."""
    text = f"{title} {description}".lower()
    topics = []
    keyword_map = {
        "uav": "UAV operations", "uas": "UAS systems", "drone": "drone services",
        "autonomous": "autonomous systems", "fpga": "FPGA engineering",
        "lidar": "LiDAR mapping", "inspection": "inspection services",
        "counter": "counter-UAS", "surveillance": "surveillance systems",
        "payload": "payload integration", "simulation": "simulation",
        "firmware": "firmware development", "navigation": "autonomous navigation",
        "swarm": "swarm coordination", "mapping": "aerial mapping",
    }
    for kw, topic in keyword_map.items():
        if kw in text:
            topics.append(topic)
    return topics[:10]
