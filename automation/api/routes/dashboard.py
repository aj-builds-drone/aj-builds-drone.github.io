"""
AJ Builds Drone — Dashboard routes.

Serves the admin dashboard SPA and provides analytics API endpoints
for campaign performance, university map data, and prospect detail views.
"""

import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import HTMLResponse, FileResponse
from sqlalchemy import select, func, case, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models.prospect import DroneProspect, OutreachEmail, LabAudit

logger = logging.getLogger("drone.dashboard")

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


# ═══════════════════════════════════════════════════════════════════════
# Dashboard HTML — serves the SPA
# ═══════════════════════════════════════════════════════════════════════

@router.get("", response_class=HTMLResponse)
async def serve_dashboard():
    """Serve the admin dashboard SPA."""
    import pathlib
    html_path = pathlib.Path(__file__).parent.parent / "static" / "dashboard.html"
    return HTMLResponse(content=html_path.read_text(), status_code=200)


# ═══════════════════════════════════════════════════════════════════════
# Campaign Analytics — open/click rates by segment
# ═══════════════════════════════════════════════════════════════════════

@router.get("/analytics/campaign")
async def campaign_analytics(db: AsyncSession = Depends(get_db)):
    """
    Campaign analytics: open rate, click rate, reply rate broken down by
    organization type, sequence step, and time period.
    """
    # ── By org type ──
    org_stats = await db.execute(
        select(
            DroneProspect.organization_type,
            func.count(OutreachEmail.id).label("sent"),
            func.count(OutreachEmail.opened_at).label("opened"),
            func.count(OutreachEmail.clicked_at).label("clicked"),
            func.count(OutreachEmail.replied_at).label("replied"),
        )
        .join(DroneProspect, OutreachEmail.prospect_id == DroneProspect.id)
        .where(OutreachEmail.status == "sent")
        .group_by(DroneProspect.organization_type)
    )
    by_org_type = []
    for row in org_stats.fetchall():
        org = row[0] or "unknown"
        sent = row[1]
        by_org_type.append({
            "org_type": org,
            "sent": sent,
            "opened": row[2],
            "clicked": row[3],
            "replied": row[4],
            "open_rate": round(row[2] / sent * 100, 1) if sent else 0,
            "click_rate": round(row[3] / sent * 100, 1) if sent else 0,
            "reply_rate": round(row[4] / sent * 100, 1) if sent else 0,
        })

    # ── By sequence step ──
    step_stats = await db.execute(
        select(
            OutreachEmail.sequence_step,
            func.count(OutreachEmail.id).label("sent"),
            func.count(OutreachEmail.opened_at).label("opened"),
            func.count(OutreachEmail.clicked_at).label("clicked"),
            func.count(OutreachEmail.replied_at).label("replied"),
        )
        .where(OutreachEmail.status == "sent")
        .group_by(OutreachEmail.sequence_step)
        .order_by(OutreachEmail.sequence_step)
    )
    by_step = []
    for row in step_stats.fetchall():
        sent = row[1]
        by_step.append({
            "step": row[0],
            "sent": sent,
            "opened": row[1] and row[2],
            "clicked": row[3],
            "replied": row[4],
            "open_rate": round(row[2] / sent * 100, 1) if sent else 0,
            "click_rate": round(row[3] / sent * 100, 1) if sent else 0,
            "reply_rate": round(row[4] / sent * 100, 1) if sent else 0,
        })

    # ── By template ──
    template_stats = await db.execute(
        select(
            OutreachEmail.template_id,
            func.count(OutreachEmail.id).label("sent"),
            func.count(OutreachEmail.opened_at).label("opened"),
            func.count(OutreachEmail.clicked_at).label("clicked"),
            func.count(OutreachEmail.replied_at).label("replied"),
        )
        .where(OutreachEmail.status == "sent")
        .group_by(OutreachEmail.template_id)
    )
    by_template = []
    for row in template_stats.fetchall():
        sent = row[1]
        by_template.append({
            "template": row[0] or "unknown",
            "sent": sent,
            "opened": row[2],
            "clicked": row[3],
            "replied": row[4],
            "open_rate": round(row[2] / sent * 100, 1) if sent else 0,
            "click_rate": round(row[3] / sent * 100, 1) if sent else 0,
            "reply_rate": round(row[4] / sent * 100, 1) if sent else 0,
        })

    # ── Daily send volume (last 30 days) ──
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    daily_q = await db.execute(
        select(
            func.date(OutreachEmail.sent_at).label("day"),
            func.count(OutreachEmail.id),
        )
        .where(
            OutreachEmail.sent_at.isnot(None),
            OutreachEmail.sent_at >= thirty_days_ago,
        )
        .group_by(func.date(OutreachEmail.sent_at))
        .order_by(func.date(OutreachEmail.sent_at))
    )
    daily_volume = [{"date": str(r[0]), "count": r[1]} for r in daily_q.fetchall()]

    return {
        "by_org_type": by_org_type,
        "by_step": by_step,
        "by_template": by_template,
        "daily_volume": daily_volume,
    }


# ═══════════════════════════════════════════════════════════════════════
# University Map Data — lat/lng markers for Leaflet
# ═══════════════════════════════════════════════════════════════════════

@router.get("/map-data")
async def get_map_data(db: AsyncSession = Depends(get_db)):
    """
    Return lat/lng + metadata for all prospects with coordinates.
    Used by the Leaflet scatter map on the dashboard.
    """
    result = await db.execute(
        select(
            DroneProspect.id,
            DroneProspect.name,
            DroneProspect.organization,
            DroneProspect.department,
            DroneProspect.lat,
            DroneProspect.lng,
            DroneProspect.tier,
            DroneProspect.status,
            DroneProspect.priority_score,
            DroneProspect.organization_type,
            DroneProspect.city,
            DroneProspect.state,
        )
        .where(
            DroneProspect.lat.isnot(None),
            DroneProspect.lng.isnot(None),
        )
    )
    markers = []
    for r in result.fetchall():
        markers.append({
            "id": str(r[0]),
            "name": r[1],
            "org": r[2],
            "dept": r[3],
            "lat": float(r[4]),
            "lng": float(r[5]),
            "tier": r[6] or "unscored",
            "status": r[7],
            "score": r[8],
            "org_type": r[9],
            "city": r[10],
            "state": r[11],
        })
    return {"markers": markers, "total": len(markers)}


# ═══════════════════════════════════════════════════════════════════════
# Professor Detail View
# ═══════════════════════════════════════════════════════════════════════

@router.get("/prospect/{prospect_id}")
async def prospect_detail(prospect_id: str, db: AsyncSession = Depends(get_db)):
    """
    Full professor detail view: profile, research, outreach history,
    lab audit, email timeline.
    """
    prospect = await db.get(DroneProspect, prospect_id)
    if not prospect:
        from fastapi import HTTPException
        raise HTTPException(404, "Prospect not found")

    # Full profile
    profile = prospect.to_dict()

    # Lab audits
    audits_q = await db.execute(
        select(LabAudit)
        .where(LabAudit.prospect_id == prospect_id)
        .order_by(desc(LabAudit.audited_at))
    )
    audits = []
    for a in audits_q.scalars().all():
        audits.append({
            "id": str(a.id),
            "hardware_score": a.hardware_score,
            "software_score": a.software_score,
            "research_score": a.research_score,
            "overall_score": a.overall_score,
            "competitive_gap": a.competitive_gap,
            "recommendations": a.recommendations,
            "created_at": a.audited_at.isoformat() if a.audited_at else None,
        })

    # Email timeline
    emails_q = await db.execute(
        select(OutreachEmail)
        .where(OutreachEmail.prospect_id == prospect_id)
        .order_by(OutreachEmail.sequence_step)
    )
    emails = []
    for e in emails_q.scalars().all():
        emails.append({
            "id": str(e.id),
            "step": e.sequence_step,
            "subject": e.subject,
            "template": e.template_id,
            "status": e.status,
            "body_html": bool(e.body_html),
            "scheduled_for": e.scheduled_for.isoformat() if e.scheduled_for else None,
            "sent_at": e.sent_at.isoformat() if e.sent_at else None,
            "opened_at": e.opened_at.isoformat() if e.opened_at else None,
            "open_count": e.open_count or 0,
            "clicked_at": e.clicked_at.isoformat() if e.clicked_at else None,
            "click_count": e.click_count or 0,
            "replied_at": e.replied_at.isoformat() if e.replied_at else None,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        })

    return {
        "profile": profile,
        "audits": audits,
        "emails": emails,
    }


# ═══════════════════════════════════════════════════════════════════════
# Activity Feed — recent events across the pipeline
# ═══════════════════════════════════════════════════════════════════════

@router.get("/activity-feed")
async def activity_feed(
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Recent activity across the pipeline — for the dashboard feed."""
    from api.models.activity_log import ActivityLog
    result = await db.execute(
        select(ActivityLog)
        .order_by(desc(ActivityLog.created_at))
        .limit(limit)
    )
    activities = []
    for a in result.scalars().all():
        activities.append({
            "id": str(a.id),
            "entity_type": a.entity_type,
            "entity_id": a.entity_id,
            "action": a.action,
            "description": a.description,
            "icon": a.icon,
            "actor": a.actor,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })
    return {"activities": activities}
