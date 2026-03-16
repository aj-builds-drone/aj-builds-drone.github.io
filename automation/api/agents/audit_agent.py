"""
Audit Agent — Lab Capability Analysis Wrapper.

Wraps the lab_auditor + peer_comparison + report_generator pipeline.
Discovers lab capabilities from publications, enrichment data, and profiles.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any

from sqlalchemy import select, func

from api.database import async_session_factory
from api.models.prospect import DroneProspect, LabAudit
from api.services.lab_auditor import batch_audit_prospects
from api.services.peer_comparison import update_prospect_peer_comparison
from api.services.report_generator import generate_and_store_report

logger = logging.getLogger("drone.agents.audit")


async def execute_audit_cycle(batch_size: int = 20) -> Dict[str, Any]:
    """
    Execute one Lab Audit cycle:
    1. Audit unaudited prospects (lab_auditor)
    2. Run peer comparison on newly audited
    3. Generate capability reports

    Returns summary dict.
    """
    logger.info("[Audit] Starting lab audit cycle — batch_size=%d", batch_size)

    # Step 1: Batch audit
    audited_count = await batch_audit_prospects(limit=batch_size)

    if audited_count == 0:
        return {
            "audited": 0,
            "peer_compared": 0,
            "reports_generated": 0,
            "log": "No prospects ready for audit",
        }

    # Step 2: Peer comparison for recently audited
    peer_compared = 0
    reports_generated = 0

    async with async_session_factory() as db:
        result = await db.execute(
            select(DroneProspect.id).where(
                DroneProspect.audited_at.isnot(None),
                DroneProspect.peer_labs.is_(None),
            ).order_by(DroneProspect.audited_at.desc()).limit(batch_size)
        )
        ids_for_peers = [str(r[0]) for r in result.fetchall()]

    for pid in ids_for_peers:
        try:
            peer_result = await update_prospect_peer_comparison(pid)
            if peer_result:
                peer_compared += 1
                # Step 3: Generate report
                report = await generate_and_store_report(pid, peer_data=peer_result)
                if report:
                    reports_generated += 1
        except Exception as e:
            logger.error("[Audit] Peer/report error for %s: %s", pid, e)

    log_output = (
        f"Lab audit cycle completed:\n"
        f"  - Prospects audited: {audited_count}\n"
        f"  - Peer comparisons: {peer_compared}\n"
        f"  - Reports generated: {reports_generated}\n"
    )
    logger.info(log_output)

    return {
        "audited": audited_count,
        "peer_compared": peer_compared,
        "reports_generated": reports_generated,
        "log": log_output,
    }


async def get_audit_stats() -> Dict[str, Any]:
    """Get Lab Audit Agent performance statistics."""
    async with async_session_factory() as db:
        # Total audits completed
        result = await db.execute(select(func.count(LabAudit.id)))
        total_audits = result.scalar() or 0

        # Audits today
        result = await db.execute(
            select(func.count(LabAudit.id)).where(
                LabAudit.audited_at >= datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)
            )
        )
        audits_today = result.scalar() or 0

        # Awaiting audit
        result = await db.execute(
            select(func.count(DroneProspect.id)).where(
                DroneProspect.audited_at.is_(None),
                DroneProspect.status.in_(["discovered", "enriched"]),
            )
        )
        awaiting_audit = result.scalar() or 0

        # Average overall score (last 100 audits)
        result = await db.execute(
            select(func.avg(LabAudit.overall_score))
            .order_by(LabAudit.audited_at.desc())
            .limit(100)
        )
        avg_score = result.scalar() or 0.0

    return {
        "total_audits": total_audits,
        "audits_today": audits_today,
        "awaiting_audit": awaiting_audit,
        "avg_overall_score": round(float(avg_score), 1),
    }
