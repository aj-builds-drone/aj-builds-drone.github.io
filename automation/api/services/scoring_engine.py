"""
Drone Scoring Engine — Outreach Priority Score.

Calculates a 0–100 score predicting how likely a prospect (professor,
lab, drone operator, etc.) is to engage with AJ Builds Drone services.

    priority_score = NEED (0-40) + ABILITY (0-30) + TIMING (0-30)

Signals are specific to the drone/academic domain:
- NEED: gaps in hardware, FPGA, simulation, custom builds
- ABILITY: grant funding, university tier, lab size
- TIMING: new grants, semesters, competition deadlines, job postings
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import selectinload

from api.database import async_session_factory
from api.models.prospect import DroneProspect, LabAudit

logger = logging.getLogger("drone.scoring")


# ═══════════════════════════════════════════════════════════════════════
# Component 1: NEED (0–40)
# How much external hardware/FPGA/drone engineering help do they need?
# ═══════════════════════════════════════════════════════════════════════

def _score_need(prospect: "DroneProspect", audit: Optional["LabAudit"]) -> tuple[int, list[str]]:
    points = 0
    signals = []

    # Only score hardware gaps when we have enrichment data
    enriched = prospect.enriched_at is not None

    # No custom drone hardware (DJI only) — only if we actually know their hardware
    hw = prospect.hardware_platforms or []
    if hw:
        if not prospect.has_custom_hardware and any("dji" in h.lower() for h in hw):
            points += 15
            signals.append("no_custom_hw:+15")
    elif enriched:
        # Enriched but no hardware listed — likely no custom hw
        points += 10
        signals.append("no_custom_hw_enriched:+10")

    # No FPGA or edge compute — only meaningful if enriched
    if enriched and not prospect.has_fpga:
        points += 10
        signals.append("no_fpga:+10")
    if audit and not audit.edge_compute or (audit and audit.edge_compute == "None"):
        points += 3
        signals.append("no_edge_compute:+3")

    # No simulation environment — only if enriched
    sim = prospect.simulation_setup or "Unknown"
    if enriched and sim.lower() in ("none", "unknown", ""):
        points += 8
        signals.append("no_simulation:+8")

    # Outdated flight controller version
    fc_ver = prospect.flight_controller_version or ""
    if fc_ver:
        try:
            major_minor = fc_ver.replace("v", "").split(".")
            if len(major_minor) >= 2 and float(f"{major_minor[0]}.{major_minor[1]}") < 1.14:
                points += 5
                signals.append(f"outdated_fc_{fc_ver}:+5")
        except (ValueError, IndexError):
            pass

    # No sensor integration beyond camera — only if we have sensor data
    sensors = prospect.sensor_types or []
    if sensors and len(sensors) <= 1 and (sensors == ["camera"]):
        points += 5
        signals.append("camera_only:+5")

    # Low publication rate
    pub_rate = float(prospect.publication_rate) if prospect.publication_rate else 0
    if 0 < pub_rate < 2:
        points += 3
        signals.append(f"low_pub_rate_{pub_rate}:+3")

    # Small lab
    students = prospect.lab_students_count or 0
    if 0 < students < 3:
        points += 4
        signals.append(f"small_lab_{students}:+4")

    # Audit-based signals
    if audit:
        if audit.hardware_score is not None and audit.hardware_score < 40:
            points += 5
            signals.append(f"audit_hw_low_{audit.hardware_score}:+5")
        if audit.software_score is not None and audit.software_score < 40:
            points += 3
            signals.append(f"audit_sw_low_{audit.software_score}:+3")

    # Baseline need: every drone researcher could use custom hardware help
    if not signals:
        points += 5
        signals.append("baseline_need:+5")

    return min(points, 40), signals


# ═══════════════════════════════════════════════════════════════════════
# Component 2: ABILITY (0–30)
# Can they afford drone engineering help?
# ═══════════════════════════════════════════════════════════════════════

TOP_100_UNIVERSITIES = {
    "mit", "stanford", "caltech", "carnegie mellon", "georgia tech",
    "uc berkeley", "university of michigan", "purdue", "cornell",
    "university of texas", "ut austin", "university of illinois",
    "uiuc", "university of pennsylvania", "columbia", "princeton",
    "harvard", "yale", "university of maryland", "virginia tech",
    "nc state", "penn state", "university of florida", "ohio state",
    "university of washington", "university of colorado", "arizona state",
    "university of southern california", "usc", "northwestern", "duke",
    "rice", "university of wisconsin", "texas a&m", "university of minnesota",
    "university of arizona", "university of virginia", "brown", "dartmouth",
    "johns hopkins", "washington university", "university of pittsburgh",
    "university of notre dame", "boston university", "rensselaer",
    "university of utah", "clemson", "iowa state", "university of iowa",
}


def _score_ability(prospect: "DroneProspect") -> tuple[int, list[str]]:
    points = 0
    signals = []

    # Active NSF/DOD/DARPA grant
    grants = prospect.active_grants or []
    total_funding = prospect.total_grant_funding or 0
    if total_funding > 200_000:
        points += 15
        signals.append(f"grant_funding_{total_funding}:+15")
    elif total_funding > 50_000:
        points += 10
        signals.append(f"grant_funding_{total_funding}:+10")
    elif grants:
        points += 5
        signals.append("has_grants:+5")

    # Top-100 university
    org = (prospect.organization or "").lower()
    if any(u in org for u in TOP_100_UNIVERSITIES):
        points += 8
        signals.append("top_100_university:+8")
    elif org and org != "unknown":
        # Any identified university/institution has some budget
        points += 3
        signals.append("identified_org:+3")

    # Has dedicated drone lab
    if prospect.has_drone_lab:
        points += 5
        signals.append("has_drone_lab:+5")

    # Large lab (10+ students)
    students = prospect.lab_students_count or 0
    if students >= 10:
        points += 5
        signals.append(f"large_lab_{students}:+5")
    elif students >= 5:
        points += 3
        signals.append(f"medium_lab_{students}:+3")

    # Defense/government (bigger budgets)
    org_type = (prospect.organization_type or "").lower()
    if org_type in ("defense_contractor", "government"):
        points += 5
        signals.append(f"org_type_{org_type}:+5")
    elif org_type == "startup":
        points += 3
        signals.append("startup_budget:+3")

    # High h-index (established researcher, more influence)
    h = prospect.h_index or 0
    if h >= 30:
        points += 5
        signals.append(f"high_h_index_{h}:+5")
    elif h >= 15:
        points += 3
        signals.append(f"med_h_index_{h}:+3")

    # Has publications (active researcher)
    papers = prospect.recent_papers or []
    if len(papers) >= 5:
        points += 3
        signals.append(f"active_publisher_{len(papers)}:+3")

    return min(points, 30), signals


# ═══════════════════════════════════════════════════════════════════════
# Component 3: TIMING (0–30)
# Is NOW the right time to reach out?
# ═══════════════════════════════════════════════════════════════════════

def _score_timing(prospect: "DroneProspect") -> tuple[int, list[str]]:
    points = 0
    signals = []
    now = datetime.now(timezone.utc)

    # Grant awarded in last 6 months
    for grant in (prospect.active_grants or []):
        start_year = grant.get("start_year")
        if start_year and start_year >= now.year:
            points += 15
            signals.append("new_grant:+15")
            break
        elif start_year and start_year >= now.year - 1:
            points += 8
            signals.append("recent_grant:+8")
            break

    # New semester starting (Aug-Sep or Jan-Feb)
    if now.month in (1, 2, 8, 9):
        points += 5
        signals.append("semester_start:+5")

    # Recent paper mentions "future work" — checked via enrichment
    enrichment = prospect.enrichment or {}
    if enrichment.get("mentions_future_work"):
        points += 5
        signals.append("future_work_mention:+5")

    # Job posting for drone/robotics engineer — checked via enrichment
    if enrichment.get("hiring_drone_engineer"):
        points += 10
        signals.append("hiring_drone_engineer:+10")

    # Conference submission deadline approaching — checked via enrichment
    if enrichment.get("upcoming_conference_deadline"):
        points += 5
        signals.append("conference_deadline:+5")

    # Competition deadline (e.g., SUAS, AUVSI)
    if enrichment.get("competition_deadline"):
        points += 10
        signals.append("competition_deadline:+10")

    # Prospect was recently discovered (fresh lead)
    if prospect.created_at:
        created = prospect.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        days_old = (now - created).days
        if days_old < 7:
            points += 3
            signals.append("fresh_lead:+3")

    return min(points, 30), signals


# ═══════════════════════════════════════════════════════════════════════
# Main Scoring Function
# ═══════════════════════════════════════════════════════════════════════

def calculate_drone_score(prospect: "DroneProspect", audit: Optional["LabAudit"] = None) -> dict:
    """
    Calculate Drone Outreach Priority Score for a single prospect.

    Returns:
        {
            "priority_score": int (0-100),
            "need": int (0-40),
            "ability": int (0-30),
            "timing": int (0-30),
            "need_signals": [...],
            "ability_signals": [...],
            "timing_signals": [...],
            "tier": "hot" | "warm" | "cool" | "cold",
        }
    """
    need, need_signals = _score_need(prospect, audit)
    ability, ability_signals = _score_ability(prospect)
    timing, timing_signals = _score_timing(prospect)

    score = need + ability + timing

    if score >= 55:
        tier = "hot"
    elif score >= 35:
        tier = "warm"
    elif score >= 20:
        tier = "cool"
    else:
        tier = "cold"

    return {
        "priority_score": score,
        "need": need,
        "ability": ability,
        "timing": timing,
        "need_signals": need_signals,
        "ability_signals": ability_signals,
        "timing_signals": timing_signals,
        "tier": tier,
    }


async def score_prospect(prospect_id: str) -> Optional[dict]:
    """
    Calculate and persist priority score for a single prospect.
    Called by pipeline worker after enrichment/audit.
    """
    async with async_session_factory() as db:
        prospect = await db.get(
            DroneProspect, prospect_id,
            options=[selectinload(DroneProspect.audits)],
        )
        if not prospect:
            logger.warning("Prospect %s not found for scoring", prospect_id)
            return None

        audit = None
        if prospect.audits:
            audit = sorted(
                prospect.audits,
                key=lambda a: a.audited_at or datetime.min,
                reverse=True,
            )[0]

        result = calculate_drone_score(prospect, audit)

        prospect.need_score = result["need"]
        prospect.ability_score = result["ability"]
        prospect.timing_score = result["timing"]
        prospect.priority_score = result["priority_score"]
        prospect.score_json = result
        prospect.tier = result["tier"]
        prospect.updated_at = datetime.now(timezone.utc)

        # Advance status to "scored" if still in early pipeline stages
        if prospect.status in ("discovered", "enriched", "audited"):
            prospect.status = "scored"

        await db.commit()
        logger.info(
            "Scored %s (%s): priority=%d (need=%d ability=%d timing=%d) → %s",
            prospect.name, prospect.organization,
            result["priority_score"], result["need"], result["ability"],
            result["timing"], result["tier"],
        )
        return result


async def batch_score_prospects(limit: int = 50) -> int:
    """Score all enriched/audited prospects that haven't been scored yet."""
    from sqlalchemy import select

    async with async_session_factory() as db:
        result = await db.execute(
            select(DroneProspect.id).where(
                DroneProspect.priority_score.is_(None),
                DroneProspect.status.in_(["enriched", "audited", "discovered"]),
            ).order_by(DroneProspect.created_at.asc()).limit(limit)
        )
        ids = [str(r[0]) for r in result.fetchall()]

    count = 0
    for pid in ids:
        r = await score_prospect(pid)
        if r:
            count += 1
    logger.info("Batch scored %d/%d drone prospects", count, len(ids))
    return count