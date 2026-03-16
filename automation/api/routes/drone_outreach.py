"""
Drone Outreach — API Routes.

CRUD for drone prospects, lab audits, emails, sequences.
Discovery endpoints for Scholar, NSF, Faculty crawls.
Pipeline control, stats, and export.
"""

import csv
import io
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select, case, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db, async_session_factory
from api.config import settings
from api.models.prospect import (
    DiscoveryBatch,
    DroneProspect,
    LabAudit,
    OutreachEmail,
    OutreachSequence,
    ProspectActivity,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/outreach", tags=["drone-outreach"])


# ═══════════════════════════════════════════════════════════════════════
# Agent State
# ═══════════════════════════════════════════════════════════════════════

_agent_state = {
    "status": "idle",
    "current_task": None,
    "started_at": None,
    "error": None,
}


@router.get("/agent/status")
async def get_agent_status():
    return _agent_state


# ═══════════════════════════════════════════════════════════════════════
# Discovery
# ═══════════════════════════════════════════════════════════════════════

@router.post("/discover/scholar")
async def trigger_scholar_crawl(body: dict = {}):
    """Trigger a Google Scholar discovery crawl."""
    from api.services.scholar_crawler import crawl_scholar
    query = body.get("query")
    max_pages = body.get("max_pages", 2)
    result = await crawl_scholar(query=query, max_pages=max_pages)
    return result


@router.post("/discover/nsf")
async def trigger_nsf_crawl(body: dict = {}):
    """Trigger an NSF Award Search discovery crawl."""
    from api.services.nsf_crawler import crawl_nsf
    query = body.get("query")
    result = await crawl_nsf(query=query)
    return result


@router.post("/discover/faculty")
async def trigger_faculty_crawl(body: dict = {}):
    """Trigger a university faculty page crawl."""
    from api.services.faculty_crawler import crawl_faculty_pages
    result = await crawl_faculty_pages()
    return result


@router.post("/discover/arxiv")
async def trigger_arxiv_crawl(body: dict = {}):
    """Trigger an arXiv paper discovery crawl."""
    from api.services.arxiv_crawler import discover_arxiv_prospects
    result = await discover_arxiv_prospects()
    return result


@router.post("/discover/dedup")
async def trigger_deduplication(body: dict = {}):
    """Trigger cross-source de-duplication of prospects."""
    from api.services.dedup_engine import run_deduplication
    result = await run_deduplication()
    return result


@router.post("/discover/github")
async def trigger_github_crawl(body: dict = {}):
    """Trigger GitHub contributor discovery crawl (PX4, ArduPilot, ROS2)."""
    from api.services.github_crawler import crawl_github_contributors
    repos = body.get("repos")  # Optional: override default repos
    result = await crawl_github_contributors(repos)
    return result


@router.post("/discover/sam-gov")
async def trigger_sam_gov_crawl(body: dict = {}):
    """Trigger SAM.gov government solicitation discovery crawl."""
    from api.services.sam_crawler import crawl_sam_gov
    result = await crawl_sam_gov()
    return result


@router.post("/discover/seed-batch")
async def seed_batch(body: dict = {}):
    """
    Seed a large initial batch of prospects by triggering all discovery sources.
    Used to bootstrap the pipeline with 500+ prospects.
    """
    sources = body.get("sources", ["scholar", "nsf", "faculty", "arxiv", "github", "sam_gov"])
    results = {}

    if "scholar" in sources:
        from api.services.scholar_crawler import crawl_scholar
        results["scholar"] = await crawl_scholar(max_pages=5)

    if "nsf" in sources:
        from api.services.nsf_crawler import crawl_nsf
        results["nsf"] = await crawl_nsf()

    if "faculty" in sources:
        from api.services.faculty_crawler import crawl_faculty_pages
        results["faculty"] = await crawl_faculty_pages()

    if "arxiv" in sources:
        from api.services.arxiv_crawler import discover_arxiv_prospects
        results["arxiv"] = await discover_arxiv_prospects()

    if "github" in sources:
        from api.services.github_crawler import crawl_github_contributors
        results["github"] = await crawl_github_contributors()

    if "sam_gov" in sources:
        from api.services.sam_crawler import crawl_sam_gov
        results["sam_gov"] = await crawl_sam_gov()

    total_new = sum(r.get("prospects_new", 0) for r in results.values())
    total_found = sum(r.get("prospects_found", 0) for r in results.values())

    return {
        "sources_run": len(results),
        "total_found": total_found,
        "total_new": total_new,
        "details": results,
    }


@router.get("/discover/batches")
async def list_discovery_batches(
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List recent discovery batches."""
    result = await db.execute(
        select(DiscoveryBatch)
        .order_by(DiscoveryBatch.created_at.desc())
        .limit(limit)
    )
    return [b.to_dict() for b in result.scalars().all()]


# ═══════════════════════════════════════════════════════════════════════
# Prospects — CRUD
# ═══════════════════════════════════════════════════════════════════════

@router.get("/prospects")
async def list_prospects(
    status: Optional[str] = None,
    tier: Optional[str] = None,
    source: Optional[str] = None,
    org_type: Optional[str] = None,
    search: Optional[str] = None,
    has_email: Optional[bool] = None,
    has_h_index: Optional[bool] = None,
    has_lab: Optional[bool] = None,
    has_drone_lab: Optional[bool] = None,
    has_grants: Optional[bool] = None,
    sort: str = Query("priority_score", pattern="^(priority_score|created_at|h_index|name|organization)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List drone prospects with filtering and sorting."""
    q = select(DroneProspect)

    if status:
        q = q.where(DroneProspect.status == status)
    if tier:
        q = q.where(DroneProspect.tier == tier)
    if source:
        q = q.where(DroneProspect.source == source)
    if org_type:
        q = q.where(DroneProspect.organization_type == org_type)
    if has_email is True:
        q = q.where(DroneProspect.email.isnot(None), DroneProspect.email != "")
    elif has_email is False:
        q = q.where(or_(DroneProspect.email.is_(None), DroneProspect.email == ""))
    if has_h_index is True:
        q = q.where(DroneProspect.h_index.isnot(None))
    elif has_h_index is False:
        q = q.where(DroneProspect.h_index.is_(None))
    if has_lab is True:
        q = q.where(DroneProspect.lab_name.isnot(None), DroneProspect.lab_name != "")
    elif has_lab is False:
        q = q.where(or_(DroneProspect.lab_name.is_(None), DroneProspect.lab_name == ""))
    if has_drone_lab is True:
        q = q.where(DroneProspect.has_drone_lab.is_(True))
    elif has_drone_lab is False:
        q = q.where(or_(DroneProspect.has_drone_lab.is_(False), DroneProspect.has_drone_lab.is_(None)))
    if has_grants is True:
        q = q.where(DroneProspect.total_grant_funding.isnot(None), DroneProspect.total_grant_funding > 0)
    elif has_grants is False:
        q = q.where(or_(DroneProspect.total_grant_funding.is_(None), DroneProspect.total_grant_funding == 0))
    if search:
        pattern = f"%{search}%"
        q = q.where(or_(
            DroneProspect.name.ilike(pattern),
            DroneProspect.organization.ilike(pattern),
            DroneProspect.email.ilike(pattern),
            DroneProspect.lab_name.ilike(pattern),
            DroneProspect.department.ilike(pattern),
        ))

    # Sorting
    sort_col = getattr(DroneProspect, sort, DroneProspect.priority_score)
    if order == "desc":
        q = q.order_by(sort_col.desc().nullslast())
    else:
        q = q.order_by(sort_col.asc().nullsfirst())

    # Count
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    q = q.offset(offset).limit(limit)
    result = await db.execute(q)
    prospects = [p.to_list_item() for p in result.scalars().all()]

    return {"total": total, "prospects": prospects}


@router.get("/prospects/export")
async def export_prospects_csv(
    status: Optional[str] = None,
    tier: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Export prospects as CSV."""
    q = select(DroneProspect)
    if status:
        q = q.where(DroneProspect.status == status)
    if tier:
        q = q.where(DroneProspect.tier == tier)
    q = q.order_by(DroneProspect.priority_score.desc().nullslast())

    result = await db.execute(q)
    prospects = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Name", "Title", "Organization", "Department", "Email",
        "Lab Name", "H-Index", "Research Areas", "Priority Score",
        "Tier", "Status", "Source", "Grant Funding",
    ])
    for p in prospects:
        writer.writerow([
            p.name, p.title, p.organization, p.department, p.email,
            p.lab_name, p.h_index,
            "; ".join(p.research_areas or []),
            p.priority_score, p.tier, p.status, p.source,
            p.total_grant_funding,
        ])

    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=drone_prospects.csv"},
    )


@router.get("/prospects/{prospect_id}")
async def get_prospect(prospect_id: str, db: AsyncSession = Depends(get_db)):
    """Get full prospect details with audits and emails."""
    prospect = await db.get(
        DroneProspect, prospect_id,
        options=[
            selectinload(DroneProspect.audits),
            selectinload(DroneProspect.emails),
            selectinload(DroneProspect.activities),
        ],
    )
    if not prospect:
        raise HTTPException(404, "Prospect not found")

    d = prospect.to_dict()
    d["audits"] = [a.to_dict() for a in (prospect.audits or [])]
    d["emails"] = [e.to_dict() for e in (prospect.emails or [])]
    d["activities"] = [a.to_dict() for a in (prospect.activities or [])]
    return d


@router.post("/prospects", status_code=201)
async def create_prospect(body: dict, db: AsyncSession = Depends(get_db)):
    """Manually create a drone prospect."""
    prospect = DroneProspect(
        id=uuid.uuid4(),
        name=body["name"],
        organization=body.get("organization", "Unknown"),
        organization_type=body.get("organization_type", "university"),
        title=body.get("title"),
        department=body.get("department"),
        email=body.get("email"),
        lab_name=body.get("lab_name"),
        research_areas=body.get("research_areas"),
        source="manual",
        status="discovered",
    )
    db.add(prospect)
    await db.commit()
    return prospect.to_dict()


@router.patch("/prospects/{prospect_id}")
async def update_prospect(prospect_id: str, body: dict, db: AsyncSession = Depends(get_db)):
    """Update a prospect's fields."""
    prospect = await db.get(DroneProspect, prospect_id)
    if not prospect:
        raise HTTPException(404, "Prospect not found")

    allowed = {
        "name", "title", "department", "organization", "organization_type",
        "email", "phone", "linkedin_url", "scholar_url", "lab_url", "lab_name",
        "research_areas", "notes", "tags", "status", "city", "state",
        "has_drone_lab", "flight_testing_capability", "simulation_setup",
        "hardware_platforms", "software_stack", "sensor_types",
        "has_custom_hardware", "has_fpga",
    }
    for key, val in body.items():
        if key in allowed:
            setattr(prospect, key, val)

    prospect.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return prospect.to_dict()


@router.delete("/prospects/{prospect_id}")
async def delete_prospect(prospect_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a prospect and all related records."""
    prospect = await db.get(DroneProspect, prospect_id)
    if not prospect:
        raise HTTPException(404, "Prospect not found")
    await db.delete(prospect)
    await db.commit()
    return {"deleted": True}


# ═══════════════════════════════════════════════════════════════════════
# Scoring
# ═══════════════════════════════════════════════════════════════════════

@router.post("/prospects/{prospect_id}/score")
async def trigger_score(prospect_id: str):
    """Score a single prospect."""
    from api.services.scoring_engine import score_prospect
    result = await score_prospect(prospect_id)
    if not result:
        raise HTTPException(404, "Prospect not found")
    return result


@router.post("/batch/score")
async def trigger_batch_score(limit: int = Query(50, le=200)):
    """Score all unscored prospects."""
    from api.services.scoring_engine import batch_score_prospects
    count = await batch_score_prospects(limit=limit)
    return {"scored": count}


# ═══════════════════════════════════════════════════════════════════════
# Emails
# ═══════════════════════════════════════════════════════════════════════

@router.get("/emails")
async def list_emails(
    status: Optional[str] = None,
    prospect_id: Optional[str] = None,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List outreach emails."""
    q = select(OutreachEmail).order_by(OutreachEmail.created_at.desc())
    if status:
        q = q.where(OutreachEmail.status == status)
    if prospect_id:
        q = q.where(OutreachEmail.prospect_id == prospect_id)
    q = q.limit(limit)

    result = await db.execute(q)
    return [e.to_dict() for e in result.scalars().all()]


@router.get("/emails/sent")
async def list_sent_emails(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """List all non-draft emails with their status — approved, sent, opened, bounced etc.
    Gives the user full visibility into the email lifecycle."""
    from sqlalchemy import func as sa_func

    # Count by status for the overview stats
    counts_q = await db.execute(
        select(OutreachEmail.status, sa_func.count(OutreachEmail.id))
        .where(OutreachEmail.status != "draft")
        .group_by(OutreachEmail.status)
    )
    status_counts = {row[0]: row[1] for row in counts_q.fetchall()}

    # Build query for listed emails
    q = select(OutreachEmail).where(OutreachEmail.status != "draft")
    if status:
        q = q.where(OutreachEmail.status == status)
    q = q.order_by(OutreachEmail.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(q)
    emails = result.scalars().all()

    # Count total for pagination
    count_q = select(sa_func.count(OutreachEmail.id)).where(OutreachEmail.status != "draft")
    if status:
        count_q = count_q.where(OutreachEmail.status == status)
    total = (await db.execute(count_q)).scalar() or 0

    # Batch-load prospect data
    prospect_ids = {e.prospect_id for e in emails}
    prospects_map = {}
    if prospect_ids:
        p_result = await db.execute(
            select(DroneProspect).where(DroneProspect.id.in_(prospect_ids))
        )
        for p in p_result.scalars().all():
            prospects_map[p.id] = p

    return {
        "emails": [
            {
                "id": str(e.id),
                "prospect_id": str(e.prospect_id),
                "to_name": prospects_map[e.prospect_id].name if e.prospect_id in prospects_map else None,
                "to_email": prospects_map[e.prospect_id].email if e.prospect_id in prospects_map else None,
                "organization": prospects_map[e.prospect_id].organization if e.prospect_id in prospects_map else None,
                "subject": e.subject,
                "template_id": e.template_id,
                "sequence_step": e.sequence_step,
                "status": e.status,
                "sent_at": e.sent_at.isoformat() if e.sent_at else None,
                "opened_at": e.opened_at.isoformat() if e.opened_at else None,
                "open_count": e.open_count,
                "clicked_at": e.clicked_at.isoformat() if e.clicked_at else None,
                "click_count": e.click_count,
                "replied_at": e.replied_at.isoformat() if e.replied_at else None,
                "reply_sentiment": e.reply_sentiment,
                "error_message": e.error_message,
                "scheduled_for": e.scheduled_for.isoformat() if e.scheduled_for else None,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in emails
        ],
        "total": total,
        "status_counts": status_counts,
    }


@router.get("/emails/{email_id}")
async def get_email(email_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single email with full details including prospect info."""
    email = await db.get(OutreachEmail, email_id)
    if not email:
        raise HTTPException(404, "Email not found")
    data = email.to_dict()
    # Enrich with prospect name/email
    prospect = await db.get(DroneProspect, email.prospect_id)
    if prospect:
        data["to_email"] = prospect.email
        data["to_name"] = prospect.name
    return data


@router.post("/emails/{email_id}/approve")
async def approve_email(email_id: str, db: AsyncSession = Depends(get_db)):
    """Approve a draft email for sending."""
    email = await db.get(OutreachEmail, email_id)
    if not email:
        raise HTTPException(404, "Email not found")
    if email.status != "draft":
        raise HTTPException(400, f"Email is {email.status}, not draft")
    email.status = "scheduled"
    email.scheduled_for = datetime.now(timezone.utc)
    await db.commit()
    return email.to_dict()


@router.post("/emails/{email_id}/send-now")
async def send_email_now(email_id: str, db: AsyncSession = Depends(get_db)):
    """Immediately send an approved/scheduled email. Human-triggered."""
    email = await db.get(OutreachEmail, email_id)
    if not email:
        raise HTTPException(404, "Email not found")
    if email.status not in ("approved", "scheduled"):
        raise HTTPException(400, f"Email is '{email.status}' — can only send approved/scheduled emails")

    # Pre-send safety checks
    prospect = await db.get(DroneProspect, email.prospect_id)
    if not prospect:
        raise HTTPException(404, "Prospect not found")
    if not prospect.email:
        raise HTTPException(400, "Prospect has no email address")
    if prospect.status in ("replied", "meeting_booked", "converted", "dead", "do_not_contact"):
        raise HTTPException(400, f"Prospect is '{prospect.status}' — cannot send")

    # Check this step wasn't already sent
    already_sent = await db.execute(
        select(OutreachEmail.id).where(
            OutreachEmail.prospect_id == str(prospect.id),
            OutreachEmail.sequence_step == email.sequence_step,
            OutreachEmail.status == "sent",
            OutreachEmail.id != email.id,
        ).limit(1)
    )
    if already_sent.first():
        raise HTTPException(
            409, f"Step {email.sequence_step} was already sent to {prospect.name}. "
                 "Duplicate emails blocked for professionalism."
        )

    # Check for prior bounces
    bounced = await db.execute(
        select(OutreachEmail.id).where(
            OutreachEmail.prospect_id == str(prospect.id),
            OutreachEmail.status == "bounced",
        ).limit(1)
    )
    if bounced.first():
        raise HTTPException(
            400, f"A previous email to {prospect.email} bounced. "
                 "Sending blocked until address is verified."
        )

    from api.services.drone_cadence_engine import send_email_record
    result = await send_email_record(str(email.id))

    if result is True:
        return {"success": True, "status": "sent"}
    elif result == "limit_exceeded":
        raise HTTPException(429, "Daily send limit exceeded — try again tomorrow")
    else:
        # Re-read to get error
        await db.refresh(email)
        return {"success": False, "status": email.status, "error": email.error_message}


@router.delete("/emails/{email_id}")
async def delete_email(email_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a draft email."""
    email = await db.get(OutreachEmail, email_id)
    if not email:
        raise HTTPException(404, "Email not found")
    if email.status not in ("draft", "failed"):
        raise HTTPException(400, "Can only delete draft or failed emails")
    await db.delete(email)
    await db.commit()
    return {"deleted": True}


# ═══════════════════════════════════════════════════════════════════════
# Sequences
# ═══════════════════════════════════════════════════════════════════════

@router.get("/sequences")
async def list_sequences(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OutreachSequence).order_by(OutreachSequence.created_at.desc()))
    return [s.to_dict() for s in result.scalars().all()]


@router.post("/sequences")
async def create_sequence(body: dict, db: AsyncSession = Depends(get_db)):
    seq = OutreachSequence(
        id=uuid.uuid4(),
        name=body["name"],
        segment_tag=body.get("segment_tag", "university"),
        steps=body["steps"],
    )
    db.add(seq)
    await db.commit()
    return seq.to_dict()


# ═══════════════════════════════════════════════════════════════════════
# Activities
# ═══════════════════════════════════════════════════════════════════════

@router.get("/prospects/{prospect_id}/activities")
async def list_activities(prospect_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ProspectActivity)
        .where(ProspectActivity.prospect_id == prospect_id)
        .order_by(ProspectActivity.created_at.desc())
    )
    return [a.to_dict() for a in result.scalars().all()]


@router.post("/prospects/{prospect_id}/activities")
async def create_activity(prospect_id: str, body: dict, db: AsyncSession = Depends(get_db)):
    prospect = await db.get(DroneProspect, prospect_id)
    if not prospect:
        raise HTTPException(404, "Prospect not found")

    activity = ProspectActivity(
        id=uuid.uuid4(),
        prospect_id=prospect_id,
        activity_type=body.get("activity_type", "note"),
        outcome=body.get("outcome"),
        notes=body.get("notes"),
        duration_minutes=body.get("duration_minutes"),
        contact_name=body.get("contact_name"),
    )
    db.add(activity)
    await db.commit()
    return activity.to_dict()


# ═══════════════════════════════════════════════════════════════════════
# Stats & Analytics
# ═══════════════════════════════════════════════════════════════════════

@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Dashboard stats for drone outreach."""
    # Total prospects by status
    status_q = select(
        DroneProspect.status,
        func.count(DroneProspect.id),
    ).group_by(DroneProspect.status)
    status_result = await db.execute(status_q)
    status_counts = {row[0]: row[1] for row in status_result.fetchall()}

    # Total by tier
    tier_q = select(
        DroneProspect.tier,
        func.count(DroneProspect.id),
    ).group_by(DroneProspect.tier)
    tier_result = await db.execute(tier_q)
    tier_counts = {row[0] or "unscored": row[1] for row in tier_result.fetchall()}

    # Total by source
    source_q = select(
        DroneProspect.source,
        func.count(DroneProspect.id),
    ).group_by(DroneProspect.source)
    source_result = await db.execute(source_q)
    source_counts = {row[0] or "unknown": row[1] for row in source_result.fetchall()}

    # Total by org type
    org_q = select(
        DroneProspect.organization_type,
        func.count(DroneProspect.id),
    ).group_by(DroneProspect.organization_type)
    org_result = await db.execute(org_q)
    org_counts = {row[0] or "unknown": row[1] for row in org_result.fetchall()}

    # Email stats
    total_sent = (await db.execute(
        select(func.count(OutreachEmail.id)).where(OutreachEmail.status == "sent")
    )).scalar() or 0
    total_opened = (await db.execute(
        select(func.count(OutreachEmail.id)).where(OutreachEmail.opened_at.isnot(None))
    )).scalar() or 0
    total_replied = (await db.execute(
        select(func.count(OutreachEmail.id)).where(OutreachEmail.replied_at.isnot(None))
    )).scalar() or 0

    total = sum(status_counts.values())

    return {
        "total_prospects": total,
        "by_status": status_counts,
        "by_tier": tier_counts,
        "by_source": source_counts,
        "by_org_type": org_counts,
        "emails_sent": total_sent,
        "emails_opened": total_opened,
        "emails_replied": total_replied,
        "open_rate": round(total_opened / total_sent * 100, 1) if total_sent else 0,
        "reply_rate": round(total_replied / total_sent * 100, 1) if total_sent else 0,
    }


@router.get("/funnel")
async def get_funnel(db: AsyncSession = Depends(get_db)):
    """Pipeline funnel with cumulative counts: each stage = prospects that reached it or beyond."""
    stages = [
        "discovered", "enriched", "audited", "scored", "queued",
        "contacted", "opened", "replied", "meeting", "converted",
    ]
    # Map every real status to its pipeline position
    status_to_stage = {
        "discovered": 0, "enriched": 1, "audited": 2, "scored": 3,
        "queued": 4, "contacted": 5, "follow_up_1": 5, "follow_up_2": 5,
        "follow_up_3": 5, "opened": 6, "replied": 7, "meeting": 8, "converted": 9,
    }
    # Get count per status (excluding merged duplicates)
    result = await db.execute(
        select(DroneProspect.status, func.count(DroneProspect.id))
        .where(DroneProspect.status != "merged")
        .group_by(DroneProspect.status)
    )
    raw_counts = dict(result.fetchall())

    # Bucket into pipeline stages
    stage_counts = [0] * len(stages)
    for status, count in raw_counts.items():
        idx = status_to_stage.get(status)
        if idx is not None:
            stage_counts[idx] += count

    # Cumulative from right: each stage = itself + all later stages
    cumulative = [0] * len(stages)
    running = 0
    for i in range(len(stages) - 1, -1, -1):
        running += stage_counts[i]
        cumulative[i] = running

    counts = {stages[i]: cumulative[i] for i in range(len(stages))}
    return {"funnel": counts, "stages": stages}


@router.get("/top-prospects")
async def get_top_prospects(
    limit: int = Query(10, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Top prospects by priority score."""
    result = await db.execute(
        select(DroneProspect)
        .where(DroneProspect.priority_score.isnot(None))
        .order_by(DroneProspect.priority_score.desc())
        .limit(limit)
    )
    return [p.to_list_item() for p in result.scalars().all()]


# ── Agent status & control ──


@router.get("/agents/status")
async def agent_status():
    """Get status of all background agents."""
    from api.agents.scheduler import scheduler
    return scheduler.get_status()


@router.post("/agents/{agent_name}/run")
async def trigger_agent(agent_name: str):
    """Manually trigger an agent run."""
    from api.agents.scheduler import scheduler
    result = await scheduler.run_agent_now(agent_name)
    return result


@router.post("/agents/start")
async def start_all_agents():
    """Start (or restart) all agents."""
    from api.agents.scheduler import scheduler
    if scheduler._running:
        await scheduler.stop()
    await scheduler.start()
    return {"ok": True, "status": "running"}


@router.post("/agents/stop")
async def stop_all_agents():
    """Stop all agents."""
    from api.agents.scheduler import scheduler
    await scheduler.stop()
    return {"ok": True, "status": "stopped"}


@router.post("/agents/{agent_name}/pause")
async def pause_agent(agent_name: str):
    """Pause a single agent."""
    from api.agents.scheduler import scheduler
    return scheduler.pause_agent(agent_name)


@router.post("/agents/{agent_name}/resume")
async def resume_agent(agent_name: str):
    """Resume a paused agent."""
    from api.agents.scheduler import scheduler
    return scheduler.resume_agent(agent_name)


@router.post("/agents/{agent_name}/stop")
async def stop_single_agent(agent_name: str):
    """Stop a single agent entirely."""
    from api.agents.scheduler import scheduler
    return await scheduler.stop_agent(agent_name)


@router.post("/agents/{agent_name}/start")
async def start_single_agent(agent_name: str):
    """Start (or restart) a single agent."""
    from api.agents.scheduler import scheduler
    return await scheduler.start_agent(agent_name)


# ── Human-in-loop email approval ──


@router.get("/email-queue")
async def list_pending_emails(
    db: AsyncSession = Depends(get_db),
):
    """List outreach emails pending human approval.
    CRITICAL: No email is sent without explicit human approval."""
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(OutreachEmail)
        .where(OutreachEmail.status == "draft")
        .order_by(OutreachEmail.created_at.desc())
    )
    emails = result.scalars().all()

    # Batch-load prospect data for to_email / to_name
    prospect_ids = {e.prospect_id for e in emails}
    prospects_map = {}
    if prospect_ids:
        p_result = await db.execute(
            select(DroneProspect).where(DroneProspect.id.in_(prospect_ids))
        )
        for p in p_result.scalars().all():
            prospects_map[p.id] = p

    return {
        "pending": [
            {
                "id": str(e.id),
                "prospect_id": str(e.prospect_id),
                "to_email": prospects_map[e.prospect_id].email if e.prospect_id in prospects_map else None,
                "to_name": prospects_map[e.prospect_id].name if e.prospect_id in prospects_map else None,
                "subject": e.subject,
                "body_html": e.body_html,
                "template_id": e.template_id,
                "sequence_step": e.sequence_step,
                "personalization": e.personalization,
                "scheduled_for": e.scheduled_for.isoformat() if e.scheduled_for else None,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in emails
        ],
        "total": len(emails),
    }


@router.post("/email-queue/{email_id}/approve")
async def approve_email(
    email_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Approve a draft email for sending. Uses cadence engine for SMTP + tracking."""
    try:
        uid = uuid.UUID(email_id)
    except ValueError:
        raise HTTPException(404, "Email not found")
    result = await db.execute(
        select(OutreachEmail).where(OutreachEmail.id == str(uid))
    )
    email = result.scalar_one_or_none()
    if not email:
        raise HTTPException(404, "Email not found")
    if email.status != "draft":
        raise HTTPException(400, f"Email is already '{email.status}', not draft")

    # Mark as approved — cadence engine process_send_queue() will send it,
    # or send immediately if scheduled_for is in the past
    email.status = "approved"
    await db.commit()

    # If scheduled time has passed, send now via cadence engine
    now = datetime.now(timezone.utc)
    sched = email.scheduled_for
    if sched and sched.replace(tzinfo=sched.tzinfo or timezone.utc) <= now:
        from api.services.drone_cadence_engine import send_email_record
        send_result = await send_email_record(str(email.id))
        if send_result is True:
            return {"success": True, "message": "Email approved and sent"}
        elif send_result == "limit_exceeded":
            return {"success": True, "message": "Email approved — will send when quota resets"}
        else:
            return {"success": True, "message": "Email approved — send failed, will retry"}

    return {"success": True, "message": "Email approved — will send at scheduled time"}


@router.post("/email-queue/{email_id}/reject")
async def reject_email(
    email_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Reject a draft email — it will not be sent."""
    try:
        uid = uuid.UUID(email_id)
    except ValueError:
        raise HTTPException(404, "Email not found")
    result = await db.execute(
        select(OutreachEmail).where(OutreachEmail.id == str(uid))
    )
    email = result.scalar_one_or_none()
    if not email:
        raise HTTPException(404, "Email not found")
    if email.status != "draft":
        raise HTTPException(400, f"Email is already '{email.status}'")

    email.status = "rejected"
    await db.commit()

    from api.services.firebase import mark_email_rejected
    mark_email_rejected(str(email.id), "Rejected by admin")

    return {"success": True, "message": "Email rejected"}


@router.patch("/email-queue/{email_id}")
async def edit_email(
    email_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Edit a draft email's subject and/or body before approving."""
    try:
        uid = uuid.UUID(email_id)
    except ValueError:
        raise HTTPException(404, "Email not found")
    result = await db.execute(
        select(OutreachEmail).where(OutreachEmail.id == str(uid))
    )
    email = result.scalar_one_or_none()
    if not email:
        raise HTTPException(404, "Email not found")
    if email.status not in ("draft", "approved"):
        raise HTTPException(400, f"Cannot edit email with status '{email.status}'")

    if "subject" in body:
        email.subject = body["subject"]
    if "body_html" in body:
        email.body_html = body["body_html"]
    await db.commit()

    return {"success": True, "message": "Email updated"}


@router.post("/prospects/{prospect_id}/generate-draft")
async def generate_draft_for_prospect(
    prospect_id: str,
    body: dict | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Generate an email draft for a specific prospect.
    Optional body: { "step": 1 }. Defaults to step 1 if no drafts exist,
    or the next step in the sequence."""
    try:
        pid = uuid.UUID(prospect_id)
    except ValueError:
        raise HTTPException(404, "Prospect not found")

    result = await db.execute(
        select(DroneProspect).where(DroneProspect.id == str(pid))
    )
    prospect = result.scalar_one_or_none()
    if not prospect:
        raise HTTPException(404, "Prospect not found")

    # Determine step
    step = (body or {}).get("step")
    if not step:
        # Auto: find highest existing step, +1 capped at 5
        email_result = await db.execute(
            select(OutreachEmail.sequence_step)
            .where(OutreachEmail.prospect_id == str(pid))
            .order_by(OutreachEmail.sequence_step.desc())
        )
        max_step = email_result.scalar()
        step = min((max_step or 0) + 1, 5)

    # Safety: check for existing active email at this step
    existing = await db.execute(
        select(OutreachEmail.id, OutreachEmail.status).where(
            OutreachEmail.prospect_id == str(pid),
            OutreachEmail.sequence_step == step,
            OutreachEmail.status.in_(["draft", "approved", "scheduled", "sent"]),
        ).limit(1)
    )
    dup = existing.first()
    if dup:
        raise HTTPException(
            409, f"Step {step} already has a {dup[1]} email for this prospect. "
                 "Delete or reject it first to generate a new one."
        )

    from api.services.drone_template_engine import create_email_draft
    email_data = await create_email_draft(str(pid), step, skip_quality_gate=True)
    if not email_data:
        raise HTTPException(500, "Failed to generate draft — check prospect has required data")

    return {
        "success": True,
        "email": {
            "id": email_data["id"],
            "prospect_id": email_data["prospect_id"],
            "step": email_data["sequence_step"],
            "subject": email_data["subject"],
            "body_html": email_data.get("body_html", ""),
            "template_id": email_data.get("template_id"),
            "status": email_data["status"],
            "created_at": email_data.get("created_at"),
        },
    }


@router.post("/prospects/{prospect_id}/analyze-research")
async def analyze_prospect_research_endpoint(
    prospect_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger research analysis for a specific prospect."""
    try:
        pid = uuid.UUID(prospect_id)
    except ValueError:
        raise HTTPException(404, "Prospect not found")

    result = await db.execute(
        select(DroneProspect).where(DroneProspect.id == str(pid))
    )
    prospect = result.scalar_one_or_none()
    if not prospect:
        raise HTTPException(404, "Prospect not found")

    from api.agents.research_analyzer import analyze_prospect_research
    analysis = await analyze_prospect_research(str(pid))
    return {"success": True, "analysis": analysis}


@router.post("/geocode")
async def trigger_geocoding(batch_size: int = 200):
    """Manually trigger geocoding cycle to populate map coordinates."""
    from api.agents.geocoder import execute_geocoding_cycle
    result = await execute_geocoding_cycle(batch_size=batch_size)
    return result


@router.post("/reprocess-enrichment")
async def trigger_reprocess_enrichment(batch_size: int = 200):
    """Re-extract structured capabilities from existing enrichment text data."""
    from api.agents.enrichment_agent import reprocess_enrichment
    result = await reprocess_enrichment(batch_size=batch_size)
    return result


@router.post("/re-audit")
async def trigger_re_audit(batch_size: int = 100):
    """Re-audit all prospects to update capability fields from text data."""
    from api.services.lab_auditor import audit_prospect
    async with async_session_factory() as db:
        from sqlalchemy import select as sa_select
        result = await db.execute(
            sa_select(DroneProspect.id).where(
                DroneProspect.audited_at.isnot(None),
            ).limit(batch_size)
        )
        ids = [str(r[0]) for r in result.fetchall()]
    count = 0
    for pid in ids:
        r = await audit_prospect(pid)
        if r:
            count += 1
    return {"re_audited": count, "total": len(ids)}


@router.post("/email-queue/approve-batch")
async def approve_batch(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Approve multiple emails at once. Still requires explicit human action."""
    email_ids = body.get("email_ids", [])
    if not email_ids:
        return {"approved": 0, "sent": 0, "failed": 0, "total": 0}
    approved = 0
    sent = 0
    failed = 0

    for eid in email_ids:
        try:
            uid = uuid.UUID(eid)
        except ValueError:
            failed += 1
            continue
        result = await db.execute(
            select(OutreachEmail).where(OutreachEmail.id == str(uid))
        )
        email = result.scalar_one_or_none()
        if not email or email.status != "draft":
            failed += 1
            continue

        email.status = "approved"
        approved += 1

    await db.commit()

    # Send any that are past their scheduled time
    now = datetime.now(timezone.utc)
    from api.services.drone_cadence_engine import send_email_record

    for eid in email_ids:
        try:
            uid = uuid.UUID(eid)
        except ValueError:
            continue
        result = await db.execute(
            select(OutreachEmail).where(OutreachEmail.id == str(uid))
        )
        email = result.scalar_one_or_none()
        sched = email.scheduled_for if email else None
        if email and email.status == "approved" and sched and sched.replace(tzinfo=sched.tzinfo or timezone.utc) <= now:
            send_result = await send_email_record(str(email.id))
            if send_result is True:
                sent += 1
            elif send_result == "limit_exceeded":
                break
            else:
                failed += 1

    return {"approved": approved, "sent": sent, "failed": failed, "total": len(email_ids)}


# ── Tracking routes (local fallback — primary tracking via GitHub Pages + Firebase) ──


@router.get("/track/open/{tracking_id}")
async def track_open(tracking_id: str):
    """Return a 1x1 transparent PNG and record the open event."""
    from fastapi.responses import Response
    from api.services.email_tracker import record_open, TRACKING_PIXEL

    await record_open(tracking_id)
    return Response(
        content=TRACKING_PIXEL,
        media_type="image/png",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
    )


@router.get("/track/click/{tracking_id}")
async def track_click(tracking_id: str, url: str = Query(...)):
    """Record click event and redirect to the destination URL."""
    from fastapi.responses import RedirectResponse
    from api.services.email_tracker import record_click

    await record_click(tracking_id, url)

    # Validate redirect URL — only allow http/https
    if not url.startswith(("http://", "https://")):
        raise HTTPException(400, "Invalid redirect URL")

    return RedirectResponse(url=url, status_code=302)


@router.post("/track/unsubscribe/{tracking_id}")
async def track_unsubscribe(tracking_id: str):
    """Handle unsubscribe request — marks prospect as do_not_contact."""
    from api.services.email_tracker import record_unsubscribe

    success = await record_unsubscribe(tracking_id)
    if not success:
        raise HTTPException(404, "Unknown tracking ID")

    return {"success": True, "message": "You have been unsubscribed."}


# ═══════════════════════════════════════════════════════════════════════
# A/B Testing
# ═══════════════════════════════════════════════════════════════════════

@router.get("/ab-tests")
async def get_ab_test_results(experiment: str = Query(None)):
    """Get A/B test results. Optionally filter by experiment name."""
    from api.services.ab_testing import get_experiment_results
    results = await get_experiment_results(experiment)
    return results


@router.get("/ab-tests/winner/{experiment_name}")
async def get_ab_test_winner(experiment_name: str, metric: str = Query("reply_rate")):
    """Get the winning variant for a specific experiment."""
    from api.services.ab_testing import get_winning_variant
    winner = await get_winning_variant(experiment_name, metric)
    return {"experiment": experiment_name, "metric": metric, "winner": winner}


@router.get("/ab-tests/experiments")
async def list_experiments():
    """List all active A/B test experiments."""
    from api.services.ab_testing import ACTIVE_EXPERIMENTS
    return {
        name: {"step": exp["step"], "field": exp["field"], "variants": list(exp["variants"].keys())}
        for name, exp in ACTIVE_EXPERIMENTS.items()
    }


# ═══════════════════════════════════════════════════════════════════════
# Scoring Weight Optimizer
# ═══════════════════════════════════════════════════════════════════════

@router.get("/optimizer/engagement")
async def get_engagement_analysis():
    """Analyze which prospect features correlate with engagement."""
    from api.services.weight_optimizer import analyze_engagement
    return await analyze_engagement()


@router.get("/optimizer/sources")
async def get_source_performance():
    """Compare engagement rates across discovery sources."""
    from api.services.weight_optimizer import analyze_source_performance
    return await analyze_source_performance()


# ═══════════════════════════════════════════════════════════════════════
# Email Hunter
# ═══════════════════════════════════════════════════════════════════════

@router.post("/email-hunt")
async def run_email_hunt(batch_size: int = Query(30, ge=1, le=100)):
    """Run the 7-strategy email hunter on prospects missing emails."""
    from api.services.drone_email_hunter import batch_hunt_emails
    return await batch_hunt_emails(batch_size=batch_size)


@router.get("/email-hunt/stats")
async def get_email_stats():
    """Get email coverage statistics."""
    from api.services.drone_email_hunter import get_email_hunter_stats
    return await get_email_hunter_stats()


@router.post("/email-hunt/prospect/{prospect_id}")
async def hunt_email_for_single(prospect_id: str, db: AsyncSession = Depends(get_db)):
    """Run email hunter on a single prospect."""
    from api.services.drone_email_hunter import hunt_email_for_prospect
    prospect = await db.get(DroneProspect, prospect_id)
    if not prospect:
        raise HTTPException(404, "Prospect not found")
    result = await hunt_email_for_prospect(prospect)
    if result["email"]:
        prospect.email = result["email"]
        enrichment = prospect.enrichment or {}
        enrichment["email_source"] = result["source"]
        enrichment["email_found_at"] = datetime.now(timezone.utc).isoformat()
        prospect.enrichment = enrichment
        await db.commit()
    return result
