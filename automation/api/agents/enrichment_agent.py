"""
Enrichment Agent — Academic Deep Intelligence Wrapper.

Enriches DroneProspect records by scraping faculty pages, lab websites,
and cross-referencing publications to fill in hardware/software/grant
data before the lab auditor runs.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any

import aiohttp
from sqlalchemy import select, func, and_
from sqlalchemy.orm.attributes import flag_modified

from api.database import async_session_factory
from api.models.prospect import DroneProspect
from api.services.lab_auditor import (
    HARDWARE_KEYWORDS, SOFTWARE_KEYWORDS, SENSOR_KEYWORDS,
    FPGA_KEYWORDS, EDGE_COMPUTE_KEYWORDS,
    _extract_from_text, _detect_in_text,
)

logger = logging.getLogger("drone.agents.enrichment")

_HTTP_TIMEOUT = aiohttp.ClientTimeout(total=15)


async def _scrape_page_text(url: str) -> str:
    """Fetch a URL and return visible text (first 5000 chars)."""
    try:
        async with aiohttp.ClientSession(timeout=_HTTP_TIMEOUT) as session:
            async with session.get(url, headers={"User-Agent": "AJBuildsDrone/1.0"}) as resp:
                if resp.status != 200:
                    return ""
                html = await resp.text()
                # Rough text extraction: strip tags
                import re
                text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.S | re.I)
                text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.S | re.I)
                text = re.sub(r"<[^>]+>", " ", text)
                text = re.sub(r"\s+", " ", text).strip()
                return text[:5000]
    except Exception as e:
        logger.debug("Failed to scrape %s: %s", url, e)
        return ""


async def enrich_prospect(prospect_id: str) -> Dict[str, Any]:
    """
    Enrich a single DroneProspect with data from faculty/lab pages.

    Scrapes:
    - personal_site (faculty page) → bio, research info
    - lab_url → lab capabilities, equipment
    - scholar_url → already populated by crawler

    Stores merged data in prospect.enrichment JSONB.
    """
    async with async_session_factory() as db:
        prospect = await db.get(DroneProspect, prospect_id)
        if not prospect:
            return {"error": "not_found"}

        enrichment = prospect.enrichment or {}
        data_points = 0

        # Scrape faculty/personal page
        if prospect.personal_site and not enrichment.get("faculty_page_text"):
            text = await _scrape_page_text(prospect.personal_site)
            if text:
                enrichment["faculty_page_text"] = text
                data_points += 1

        # Scrape lab page
        if prospect.lab_url and not enrichment.get("lab_page_text"):
            text = await _scrape_page_text(prospect.lab_url)
            if text:
                enrichment["lab_page_text"] = text
                data_points += 1

        # Cross-reference enrichment signals from text
        all_text = " ".join([
            enrichment.get("faculty_page_text", ""),
            enrichment.get("lab_page_text", ""),
            prospect.lab_description or "",
        ]).lower()

        if all_text.strip():
            # Opportunistic email extraction during enrichment
            if not prospect.email:
                import re
                _email_re = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
                # Check the original HTML-stripped text (case-sensitive for email)
                raw_text = " ".join([
                    enrichment.get("faculty_page_text", ""),
                    enrichment.get("lab_page_text", ""),
                ])
                found_emails = _email_re.findall(raw_text)
                # Prefer .edu emails, filter out generic/image addresses
                skip = {"example.com", "email.com", "domain.com", ".png", ".jpg"}
                found_emails = [e for e in found_emails if not any(s in e.lower() for s in skip)]
                edu_emails = [e for e in found_emails if ".edu" in e.lower()]
                if edu_emails:
                    prospect.email = edu_emails[0]
                    enrichment["email_source"] = "enrichment_scrape"
                    data_points += 1
                elif found_emails:
                    prospect.email = found_emails[0]
                    enrichment["email_source"] = "enrichment_scrape"
                    data_points += 1

            # Detect future work mentions (timing signal)
            if "future work" in all_text or "ongoing" in all_text or "planned" in all_text:
                enrichment["mentions_future_work"] = True
                data_points += 1

            # Detect hiring signals
            hiring_kws = ["hiring", "position available", "postdoc", "phd opening",
                          "research assistant", "looking for students"]
            if any(kw in all_text for kw in hiring_kws):
                enrichment["hiring_drone_engineer"] = True
                data_points += 1

            # Detect competition involvement
            comp_kws = ["suas", "auvsi", "xponential", "competition", "challenge"]
            if any(kw in all_text for kw in comp_kws):
                enrichment["competition_involvement"] = True
                data_points += 1

            # ── Extract structured capabilities from text ──
            raw_text_for_detection = " ".join([
                enrichment.get("faculty_page_text", ""),
                enrichment.get("lab_page_text", ""),
                prospect.lab_description or "",
                " ".join(prospect.research_areas or []),
            ])

            detected_hw = _extract_from_text(raw_text_for_detection, HARDWARE_KEYWORDS)
            if detected_hw:
                enrichment["detected_hardware"] = detected_hw
                if not prospect.hardware_platforms:
                    prospect.hardware_platforms = detected_hw
                data_points += 1

            detected_sw = _extract_from_text(raw_text_for_detection, SOFTWARE_KEYWORDS)
            if detected_sw:
                enrichment["detected_software"] = detected_sw
                if not prospect.software_stack:
                    prospect.software_stack = detected_sw
                data_points += 1

            detected_sensors = _extract_from_text(raw_text_for_detection, SENSOR_KEYWORDS)
            if detected_sensors:
                enrichment["detected_sensors"] = detected_sensors
                if not prospect.sensor_types:
                    prospect.sensor_types = detected_sensors
                data_points += 1

            if _detect_in_text(raw_text_for_detection, FPGA_KEYWORDS):
                enrichment["has_fpga"] = True
                prospect.has_fpga = True
                data_points += 1

            for kw, label in EDGE_COMPUTE_KEYWORDS.items():
                if kw in all_text:
                    enrichment["edge_compute"] = label
                    data_points += 1
                    break

            # Mark has_drone_lab if hardware/sensors detected
            if (detected_hw or detected_sensors) and not prospect.has_drone_lab:
                prospect.has_drone_lab = True

        prospect.enrichment = enrichment
        flag_modified(prospect, "enrichment")
        prospect.enriched_at = datetime.now(timezone.utc)
        if prospect.status == "discovered":
            prospect.status = "enriched"

        await db.commit()

        logger.info("Enriched %s: %d new data points", prospect.name, data_points)
        return {"data_points": data_points, "status": "enriched"}


async def execute_enrichment_cycle(batch_size: int = 20) -> Dict[str, Any]:
    """
    Execute one Enrichment Agent cycle — gather intelligence on prospects.

    Finds prospects that have URLs but haven't been enriched yet.
    """
    logger.info("[Enrichment] Starting cycle — batch_size=%d", batch_size)

    async with async_session_factory() as db:
        result = await db.execute(
            select(DroneProspect.id).where(
                DroneProspect.enriched_at.is_(None),
                DroneProspect.status == "discovered",
            ).order_by(DroneProspect.created_at.asc()).limit(batch_size)
        )
        ids = [str(r[0]) for r in result.fetchall()]

    enriched = 0
    failed = 0

    for pid in ids:
        try:
            result = await enrich_prospect(pid)
            if result.get("status") == "enriched":
                enriched += 1
            else:
                failed += 1
        except Exception as e:
            failed += 1
            logger.error("[Enrichment] Error enriching %s: %s", pid, e)

    log_output = (
        f"Enrichment cycle completed:\n"
        f"  - Prospects enriched: {enriched}\n"
        f"  - Failed: {failed}\n"
    )
    logger.info(log_output)

    return {
        "enriched": enriched,
        "failed": failed,
        "log": log_output,
    }


async def get_enrichment_stats() -> Dict[str, Any]:
    """Get Enrichment Agent performance statistics."""
    async with async_session_factory() as db:
        result = await db.execute(
            select(func.count(DroneProspect.id)).where(
                DroneProspect.enriched_at.isnot(None),
            )
        )
        total_enriched = result.scalar() or 0

        result = await db.execute(
            select(func.count(DroneProspect.id)).where(
                and_(
                    DroneProspect.enriched_at >= datetime.now(timezone.utc).replace(hour=0, minute=0, second=0),
                )
            )
        )
        enriched_today = result.scalar() or 0

        result = await db.execute(
            select(func.count(DroneProspect.id)).where(
                DroneProspect.enriched_at.is_(None),
                DroneProspect.status == "discovered",
            )
        )
        awaiting = result.scalar() or 0

    return {
        "total_enriched": total_enriched,
        "enriched_today": enriched_today,
        "awaiting_enrichment": awaiting,
    }


async def reprocess_enrichment(batch_size: int = 100) -> Dict[str, Any]:
    """
    Re-process already-enriched prospects to extract structured capabilities
    from existing raw text data (faculty_page_text / lab_page_text).
    Targets prospects that have enrichment text but no detected_hardware key yet.
    """
    logger.info("[Enrichment] Reprocessing existing text for capabilities — batch=%d", batch_size)

    async with async_session_factory() as db:
        result = await db.execute(
            select(DroneProspect).where(
                DroneProspect.enriched_at.isnot(None),
            ).limit(batch_size)
        )
        prospects = list(result.scalars().all())

    updated = 0
    for prospect in prospects:
        enrichment = prospect.enrichment or {}
        # Skip if already has structured data
        if enrichment.get("detected_hardware") is not None:
            continue

        all_text = " ".join([
            enrichment.get("faculty_page_text", ""),
            enrichment.get("lab_page_text", ""),
            prospect.lab_description or "",
            " ".join(prospect.research_areas or []),
        ])
        if not all_text.strip():
            # Mark as processed even with no text, to avoid re-scanning
            async with async_session_factory() as db:
                p = await db.get(DroneProspect, prospect.id)
                en = p.enrichment or {}
                en["detected_hardware"] = []
                en["detected_software"] = []
                en["detected_sensors"] = []
                p.enrichment = en
                flag_modified(p, "enrichment")
                await db.commit()
            continue

        async with async_session_factory() as db:
            p = await db.get(DroneProspect, prospect.id)
            en = p.enrichment or {}

            detected_hw = _extract_from_text(all_text, HARDWARE_KEYWORDS)
            detected_sw = _extract_from_text(all_text, SOFTWARE_KEYWORDS)
            detected_sensors = _extract_from_text(all_text, SENSOR_KEYWORDS)
            has_fpga = _detect_in_text(all_text, FPGA_KEYWORDS)

            en["detected_hardware"] = detected_hw
            en["detected_software"] = detected_sw
            en["detected_sensors"] = detected_sensors
            if has_fpga:
                en["has_fpga"] = True
                p.has_fpga = True

            for kw, label in EDGE_COMPUTE_KEYWORDS.items():
                if kw in all_text.lower():
                    en["edge_compute"] = label
                    break

            if detected_hw and not p.hardware_platforms:
                p.hardware_platforms = detected_hw
            if detected_sw and not p.software_stack:
                p.software_stack = detected_sw
            if detected_sensors and not p.sensor_types:
                p.sensor_types = detected_sensors
            if (detected_hw or detected_sensors) and not p.has_drone_lab:
                p.has_drone_lab = True

            p.enrichment = en
            flag_modified(p, "enrichment")
            await db.commit()
            updated += 1

    logger.info("[Enrichment] Reprocessed %d prospects with new capability extraction", updated)
    return {"reprocessed": updated}
