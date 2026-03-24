"""
Drone Cadence Engine — Academic Outreach Sequence Scheduling & Sending.

Manages the 5-step drone outreach sequence targeting university professors.
Uses drone_template_engine.py for email composition and email_tracker.py
for open/click tracking. All emails require human approval (draft → approved → sent).

Phase 4 of OUTREACH_STRATEGY.md.
"""

import asyncio
import logging
import time as _time
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from api.config import settings
from api.database import async_session_factory
from api.models.prospect import DroneProspect, OutreachEmail

logger = logging.getLogger("drone.cadence")

# ─── Academic Send Windows (UTC) ──────────────────────────────────────
# Professors check email Tue-Thu morning. Avoid Mon (catch-up) & Fri (exits).
# Hours in UTC — US Eastern 9-11am ≈ 13-15 UTC,  US Central ≈ 14-16 UTC
SEND_WINDOWS = {
    "university":   {"days": [1, 2, 3], "hours": (13, 16)},   # Tue-Thu 9-12 ET
    "research_lab": {"days": [1, 2, 3], "hours": (13, 16)},
    "government":   {"days": [1, 2, 3, 4], "hours": (14, 17)},  # Tue-Fri
    "defense":      {"days": [0, 1, 2, 3], "hours": (14, 17)},  # Mon-Thu
    "industry":     {"days": [1, 2, 3], "hours": (14, 17)},
    "default":      {"days": [1, 2, 3], "hours": (13, 16)},
}

# Sequence step timing (days after previous step)
STEP_DELAYS = {1: 0, 2: 3, 3: 7, 4: 21, 5: 90}

# Minimum days between ANY two sends to the same prospect
MIN_STEP_GAP_DAYS = 2

# Max emails per day — start conservative
MAX_DAILY_SENDS = 100

# Academic blackout periods (month, day_start, day_end)
# Avoid finals, thesis season, winter break, spring break
_ACADEMIC_BLACKOUTS = [
    (12, 10, 31),  # December finals + winter break
    (1, 1, 7),     # New Year / winter break
    (5, 1, 15),    # May finals
]


# ─── Timing Helpers ────────────────────────────────────────────────────

def _is_blackout(dt: datetime) -> bool:
    """Check if date falls in an academic blackout period."""
    for month, day_start, day_end in _ACADEMIC_BLACKOUTS:
        if dt.month == month and day_start <= dt.day <= day_end:
            return True
    return False


def get_next_send_time(org_type: str, after: Optional[datetime] = None) -> datetime:
    """
    Calculate the next valid send time for a given organization type.
    Respects academic send windows and blackout periods.
    """
    window = SEND_WINDOWS.get(org_type, SEND_WINDOWS["default"])
    now = after or datetime.now(timezone.utc)

    for day_offset in range(30):  # Look up to 30 days ahead (blackouts)
        candidate = now + timedelta(days=day_offset)

        # Skip blackout periods
        if _is_blackout(candidate):
            continue

        if candidate.weekday() in window["days"]:
            start_h, end_h = window["hours"]

            # If same day and still in window
            if day_offset == 0 and start_h <= candidate.hour < end_h:
                return candidate.replace(minute=0, second=0, microsecond=0)

            # Schedule for start of window
            if day_offset > 0 or candidate.hour < start_h:
                return candidate.replace(
                    hour=start_h, minute=0, second=0, microsecond=0
                )

    # Fallback: tomorrow at 14:00 UTC (10 AM ET)
    return (now + timedelta(days=1)).replace(hour=14, minute=0, second=0, microsecond=0)


def is_in_send_window(org_type: str) -> bool:
    """Check if current time is in the send window for this org type."""
    window = SEND_WINDOWS.get(org_type, SEND_WINDOWS["default"])
    now = datetime.now(timezone.utc)
    if _is_blackout(now):
        return False
    start_h, end_h = window["hours"]
    return now.weekday() in window["days"] and start_h <= now.hour < end_h


# ─── Email Blocklist ──────────────────────────────────────────────────

_BLOCKED_EMAIL_PREFIXES = {
    "noreply", "no-reply", "donotreply", "do-not-reply",
    "support", "postmaster", "mailer-daemon", "abuse",
    "info", "webmaster", "admin",
}

_BLOCKED_EMAIL_DOMAINS = {
    "example.com", "test.com", "noreply.com",
}


def _is_blocked_email(email: str) -> bool:
    """Return True if email should not be contacted."""
    email = (email or "").lower().strip()
    if not email or "@" not in email:
        return True
    local, domain = email.rsplit("@", 1)
    if domain in _BLOCKED_EMAIL_DOMAINS:
        return True
    if local in _BLOCKED_EMAIL_PREFIXES:
        return True
    return False


# ─── Sequence Management ──────────────────────────────────────────────

async def enqueue_prospect(prospect_id: str) -> Optional[str]:
    """
    Enqueue a prospect for the outreach sequence.
    Creates the first email draft and schedules it.
    Returns the email ID or None.

    CRITICAL: Email is created with status='draft' — requires human approval.
    """
    from api.services.drone_template_engine import compose_drone_email

    # ── Phase 1: Validate + guard checks ─────────────────────────
    async with async_session_factory() as db:
        prospect = await db.get(DroneProspect, prospect_id)
        if not prospect:
            return None

        p_name = prospect.name
        org_type = prospect.organization_type or "default"
        p_id = prospect.id

        # Guard: don't re-enqueue active prospects
        if prospect.status in ("contacted", "follow_up_1", "follow_up_2",
                                "follow_up_3", "replied", "meeting_booked",
                                "converted", "dead", "do_not_contact"):
            logger.info("Skipping %s — already in state %s", p_name, prospect.status)
            return None

        if not prospect.email:
            logger.warning("Cannot enqueue %s — no email", p_name)
            return None

        # Guard: block bad emails
        if _is_blocked_email(prospect.email):
            logger.warning("Blocked %s — bad email: %s", p_name, prospect.email)
            return None

        # Guard: prevent duplicate step-1 emails
        existing = await db.execute(
            select(OutreachEmail.id).where(
                OutreachEmail.prospect_id == p_id,
                OutreachEmail.sequence_step == 1,
            ).limit(1)
        )
        if existing.first():
            logger.info("Skipping %s — step 1 email already exists", p_name)
            if prospect.status != "queued":
                prospect.status = "queued"
                await db.commit()
            return None

    # ── Phase 2: Compose email ────────────────────────────────────
    composed = await compose_drone_email(str(prospect_id), sequence_step=1)
    if not composed:
        logger.error("Failed to compose email for %s", p_name)
        return None

    # ── Phase 3: Create email record (with FOR UPDATE lock) ──────
    send_time = get_next_send_time(org_type)
    tracking_id = str(uuid4())

    async with async_session_factory() as db:
        prospect = await db.get(DroneProspect, prospect_id, with_for_update=True)
        if not prospect:
            return None

        # Re-check duplicate guard under lock
        existing = await db.execute(
            select(OutreachEmail.id).where(
                OutreachEmail.prospect_id == p_id,
                OutreachEmail.sequence_step == 1,
            ).limit(1)
        )
        if existing.first():
            logger.info("Skipping %s — step 1 already exists (race guard)", p_name)
            if prospect.status != "queued":
                prospect.status = "queued"
                await db.commit()
            return None

        email = OutreachEmail(
            id=uuid4(),
            prospect_id=p_id,
            sequence_step=1,
            subject=composed["subject"],
            body_html=composed["body_html"],
            body_text=composed["body_text"],
            personalization=composed["variables"],
            template_id=composed["template_id"],
            tracking_id=tracking_id,
            status="draft",  # CRITICAL: human must approve
            scheduled_for=send_time,
        )
        db.add(email)

        prospect.status = "queued"
        await db.commit()

        # Push to Firebase for admin dashboard
        try:
            from api.services.firebase import queue_email_for_approval
            queue_email_for_approval({
                "id": str(email.id),
                "prospect_id": str(p_id),
                "prospect_name": p_name,
                "to": prospect.email,
                "subject": composed["subject"],
                "body_preview": composed["body_text"][:200],
                "template": composed["template_id"],
                "step": 1,
            })
        except Exception as e:
            logger.warning("Firebase queue push failed: %s", e)

        logger.info(
            "Enqueued %s step 1 → scheduled for %s (draft)",
            p_name, send_time.isoformat(),
        )
        return str(email.id)


async def schedule_next_step(prospect_id: str, current_step: int) -> Optional[str]:
    """
    Schedule the next step in the sequence for a prospect.
    Called after successful send of current step.
    """
    from api.services.drone_template_engine import compose_drone_email

    next_step = current_step + 1
    if next_step > 5:
        return None  # Sequence complete

    delay_days = STEP_DELAYS.get(next_step, 3)

    # ── Phase 1: Check exit conditions ───────────────────────────
    async with async_session_factory() as db:
        prospect = await db.get(DroneProspect, prospect_id)
        if not prospect:
            return None

        p_name = prospect.name
        org_type = prospect.organization_type or "default"
        p_id = prospect.id

        # Check exit conditions
        if prospect.status in ("replied", "meeting_booked", "converted",
                                "dead", "do_not_contact"):
            logger.info("Not scheduling step %d for %s — status: %s",
                        next_step, p_name, prospect.status)
            return None

        # Step 5 (resurrection) — only if they opened any email
        if next_step == 5 and (prospect.emails_opened or 0) == 0:
            logger.info("Skipping resurrection for %s — never opened", p_name)
            return None

    # ── Phase 2: Compose email ────────────────────────────────────
    composed = await compose_drone_email(str(prospect_id), sequence_step=next_step)
    if not composed:
        return None

    # ── Phase 3: Create email record ──────────────────────────────
    after = datetime.now(timezone.utc) + timedelta(days=delay_days)
    send_time = get_next_send_time(org_type, after=after)
    tracking_id = str(uuid4())

    async with async_session_factory() as db:
        prospect = await db.get(DroneProspect, prospect_id)
        if not prospect:
            return None

        email = OutreachEmail(
            id=uuid4(),
            prospect_id=p_id,
            sequence_step=next_step,
            subject=composed["subject"],
            body_html=composed["body_html"],
            body_text=composed["body_text"],
            personalization=composed["variables"],
            template_id=composed["template_id"],
            tracking_id=tracking_id,
            status="draft",  # Human must approve follow-ups too
            scheduled_for=send_time,
        )
        db.add(email)

        # Update prospect status to follow-up stage
        step_status_map = {2: "follow_up_1", 3: "follow_up_2", 4: "follow_up_3", 5: "follow_up_3"}
        prospect.status = step_status_map.get(next_step, prospect.status)
        await db.commit()

        # Push to Firebase
        try:
            from api.services.firebase import queue_email_for_approval
            queue_email_for_approval({
                "id": str(email.id),
                "prospect_id": str(p_id),
                "prospect_name": p_name,
                "to": prospect.email,
                "subject": composed["subject"],
                "body_preview": composed["body_text"][:200],
                "template": composed["template_id"],
                "step": next_step,
            })
        except Exception as e:
            logger.warning("Firebase queue push failed: %s", e)

        logger.info(
            "Scheduled %s step %d → %s (draft, pending approval)",
            p_name, next_step, send_time.isoformat(),
        )
        return str(email.id)


async def send_email_record(email_id: str):
    """
    Send an approved email via SMTP.
    Updates status and tracking, notifies via Telegram, schedules next step.

    Returns True on success, False on failure, 'limit_exceeded' if quota hit.
    """
    from api.services.email_service import send_email as smtp_send
    from api.services.notify import _send_telegram_message, _esc_md
    from api.services.email_tracker import inject_tracking

    # ── Phase 1: Read email + prospect data ──────────────────────
    async with async_session_factory() as db:
        email = await db.get(OutreachEmail, email_id)
        if not email:
            return False

        # ── Safety: idempotency — only send approved/scheduled emails ──
        if email.status not in ("approved", "scheduled"):
            logger.warning(
                "Refusing to send email %s — status is '%s' (not approved/scheduled)",
                email_id, email.status,
            )
            return False

        prospect = await db.get(DroneProspect, email.prospect_id)
        if not prospect or not prospect.email:
            email.status = "failed"
            email.error_message = "No recipient email"
            await db.commit()
            return False

        # ── Safety: prospect state — don't email dead/replied/bounced prospects ──
        if prospect.status in (
            "replied", "meeting_booked", "converted",
            "dead", "do_not_contact",
        ):
            email.status = "cancelled"
            email.error_message = f"Auto-cancelled: prospect is {prospect.status}"
            await db.commit()
            logger.info(
                "Cancelled email to %s — prospect status: %s",
                prospect.name, prospect.status,
            )
            return False

        # ── Safety: blocked email address ──
        if _is_blocked_email(prospect.email):
            email.status = "failed"
            email.error_message = f"Blocked email: {prospect.email}"
            await db.commit()
            logger.warning("Blocked send to %s — bad email: %s", prospect.name, prospect.email)
            return False

        # ── Safety: duplicate step — same step already sent to this prospect ──
        already_sent = await db.execute(
            select(OutreachEmail.id).where(
                OutreachEmail.prospect_id == str(prospect.id),
                OutreachEmail.sequence_step == email.sequence_step,
                OutreachEmail.status == "sent",
                OutreachEmail.id != email.id,
            ).limit(1)
        )
        if already_sent.first():
            email.status = "cancelled"
            email.error_message = f"Duplicate: step {email.sequence_step} already sent"
            await db.commit()
            logger.warning(
                "Duplicate prevention: step %d already sent to %s (%s)",
                email.sequence_step, prospect.name, prospect.email,
            )
            return False

        # ── Safety: previous bounce — don't send if any prior email bounced ──
        bounced_check = await db.execute(
            select(OutreachEmail.id).where(
                OutreachEmail.prospect_id == str(prospect.id),
                OutreachEmail.status == "bounced",
            ).limit(1)
        )
        if bounced_check.first():
            email.status = "cancelled"
            email.error_message = "Previous email bounced — address may be invalid"
            await db.commit()
            logger.warning(
                "Bounce prevention: prior bounce for %s (%s)",
                prospect.name, prospect.email,
            )
            return False

        # Snapshot fields
        to_email = prospect.email
        subject = email.subject
        body_html = email.body_html
        tracking_id = email.tracking_id
        prospect_id = str(prospect.id)
        p_name = prospect.name
        seq_step = email.sequence_step

    # Inject tracking pixel + click tracking
    tracked_html = inject_tracking(body_html, tracking_id) if tracking_id else body_html

    # ── Phase 2: SMTP send (no DB session held) ─────────────────
    try:
        # Try SMTP pool first, fall back to basic send
        try:
            from api.services.smtp_pool import send_via_pool
            result = await send_via_pool(
                to=to_email,
                subject=subject,
                body_html=tracked_html,
                reply_to=settings.smtp_email,
            )
        except Exception:
            result = await smtp_send(
                to=to_email,
                subject=subject,
                body_html=tracked_html,
                reply_to=settings.smtp_email,
            )

        # ── Phase 3: Handle result ───────────────────────────────
        if isinstance(result, dict) and not result.get("success"):
            if result.get("limit_exceeded"):
                logger.error("Gmail limit exceeded sending to %s", p_name)
                return "limit_exceeded"
            elif result.get("bounce"):
                logger.warning("Bounce for %s (%s)", p_name, to_email)
                async with async_session_factory() as db:
                    email = await db.get(OutreachEmail, email_id)
                    if email:
                        email.status = "bounced"
                        email.error_message = result.get("message", "Bounced")[:500]
                        await db.commit()
                await handle_bounce(email_id)
                return False
            else:
                async with async_session_factory() as db:
                    email = await db.get(OutreachEmail, email_id)
                    if email:
                        email.status = "failed"
                        email.error_message = result.get("message", "SMTP error")[:500]
                        await db.commit()
                logger.error("Send failed for %s: %s", p_name, result.get("message"))
                return False

        # Success — update email + prospect
        message_id = result.get("message_id") if isinstance(result, dict) else None
        sent_at = datetime.now(timezone.utc)

        async with async_session_factory() as db:
            email = await db.get(OutreachEmail, email_id)
            prospect = await db.get(DroneProspect, prospect_id)
            if email:
                email.status = "sent"
                email.sent_at = sent_at
                email.message_id = message_id
            if prospect:
                prospect.emails_sent = (prospect.emails_sent or 0) + 1
                prospect.last_email_at = sent_at
                if prospect.status == "queued":
                    prospect.status = "contacted"
            await db.commit()

        # ── Phase 4: Notifications + next step ───────────────────
        await _send_telegram_message(
            f"📧 *Sent to {_esc_md(p_name)}*\n"
            f"📋 Step {seq_step}: {_esc_md(subject[:50])}\\.\\.\\.\n"
            f"📬 To: {_esc_md(to_email)}"
        )

        # Push to Firebase
        try:
            from api.services.firebase import mark_email_sent, _ref
            mark_email_sent(str(email_id))
            _ref("outreach/stats/last_send").set({
                "name": p_name,
                "step": seq_step,
                "ts": int(_time.time()),
            })
        except Exception as e:
            logger.warning("Firebase post-send update failed: %s", e)

        # Schedule next step in sequence
        await schedule_next_step(prospect_id, seq_step)

        logger.info("Sent email %s to %s (step %d)", email_id, to_email, seq_step)
        return True

    except Exception as e:
        async with async_session_factory() as db:
            email = await db.get(OutreachEmail, email_id)
            if email:
                email.status = "failed"
                email.error_message = str(e)[:500]
                await db.commit()
        logger.error("Send failed for %s: %s", p_name, e)
        return False


# ─── Batch Sending (Scheduler Entry Point) ───────────────────────────

async def process_send_queue() -> dict:
    """
    Process approved emails in the send queue.
    Called periodically by APScheduler. Respects daily limits and send windows.
    """
    stats = {"attempted": 0, "sent": 0, "failed": 0, "skipped": 0}
    now = datetime.now(timezone.utc)

    # Skip during academic blackout
    if _is_blackout(now):
        logger.info("Academic blackout period — skipping send queue")
        return stats

    async with async_session_factory() as db:
        # Count already sent today
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_count_result = await db.execute(
            select(func.count(OutreachEmail.id))
            .where(
                OutreachEmail.status == "sent",
                OutreachEmail.sent_at >= today_start,
            )
        )
        today_count = today_count_result.scalar() or 0

        # Use SMTP pool capacity if available
        try:
            from api.services.smtp_pool import get_pool_status
            pool = await get_pool_status()
            pool_remaining = pool.get("total_remaining", 0)
            if pool["provider_count"] > 0:
                remaining = pool_remaining
            else:
                remaining = MAX_DAILY_SENDS - today_count
        except Exception:
            remaining = MAX_DAILY_SENDS - today_count

        if remaining <= 0:
            logger.info("Daily send limit reached (%d sent today)", today_count)
            stats["skipped"] = today_count
            return stats

        # Only send approved emails whose scheduled time has passed (or is NULL = send now)
        result = await db.execute(
            select(OutreachEmail)
            .where(
                OutreachEmail.status == "approved",
                or_(
                    OutreachEmail.scheduled_for <= now,
                    OutreachEmail.scheduled_for.is_(None),
                ),
            )
            .order_by(OutreachEmail.scheduled_for)
            .limit(remaining)
        )
        candidates = result.scalars().all()

    # ── Step-spacing guard ───────────────────────────────────────
    emails = []
    dirty = False
    async with async_session_factory() as db:
        for email in candidates:
            email = await db.merge(email)

            if email.sequence_step > 1:
                # Check gap since previous step
                prev_r = await db.execute(
                    select(OutreachEmail.sent_at)
                    .where(
                        OutreachEmail.prospect_id == email.prospect_id,
                        OutreachEmail.sequence_step == email.sequence_step - 1,
                        OutreachEmail.status == "sent",
                    )
                    .order_by(OutreachEmail.sent_at.desc())
                    .limit(1)
                )
                prev_sent = prev_r.scalar()
                if prev_sent:
                    days_since = (now - prev_sent).total_seconds() / 86400
                    if days_since < MIN_STEP_GAP_DAYS:
                        logger.info(
                            "Skipping step %d for prospect %s — only %.1f days since step %d",
                            email.sequence_step, email.prospect_id,
                            days_since, email.sequence_step - 1,
                        )
                        continue
                else:
                    # Previous step never sent — check if cancelled/bounced
                    prev_exists_r = await db.execute(
                        select(OutreachEmail.status)
                        .where(
                            OutreachEmail.prospect_id == email.prospect_id,
                            OutreachEmail.sequence_step == email.sequence_step - 1,
                        )
                        .order_by(OutreachEmail.created_at.desc())
                        .limit(1)
                    )
                    prev_status = prev_exists_r.scalar()
                    if prev_status in ("cancelled", "bounced", None):
                        logger.info(
                            "Cancelling step %d for prospect %s — step %d is %s",
                            email.sequence_step, email.prospect_id,
                            email.sequence_step - 1, prev_status or "missing",
                        )
                        email.status = "cancelled"
                        email.error_message = f"Auto-cancelled: step {email.sequence_step - 1} {prev_status or 'missing'}"
                        dirty = True
                    continue

            # Check prospect hasn't replied, been marked do_not_contact, etc.
            prospect = await db.get(DroneProspect, email.prospect_id)
            if prospect and prospect.status in ("replied", "do_not_contact", "dead", "converted"):
                logger.info(
                    "Skipping email for %s — prospect status: %s",
                    prospect.name, prospect.status,
                )
                email.status = "cancelled"
                email.error_message = f"Auto-cancelled: prospect is {prospect.status}"
                dirty = True
                continue

            emails.append(email)

        if dirty:
            await db.commit()

    # ── Send loop ────────────────────────────────────────────────
    for email in emails:
        stats["attempted"] += 1
        result = await send_email_record(str(email.id))
        if result == "limit_exceeded":
            stats["limit_exceeded"] = True
            logger.error("Gmail daily limit reached — halting send queue")
            break
        elif result:
            stats["sent"] += 1
        else:
            stats["failed"] += 1

        # Rate limit between sends
        await asyncio.sleep(2)

    logger.info(
        "Send queue processed: %d attempted, %d sent, %d failed",
        stats["attempted"], stats["sent"], stats["failed"],
    )

    # Notify if there are pending drafts awaiting approval
    try:
        async with async_session_factory() as db:
            pending_r = await db.execute(
                select(func.count(OutreachEmail.id))
                .where(OutreachEmail.status == "draft")
            )
            pending_count = pending_r.scalar() or 0
            if pending_count > 0:
                from api.services.notify import send_telegram_emails_pending
                await send_telegram_emails_pending(pending_count)
    except Exception as e:
        logger.warning("Pending email notification failed: %s", e)

    return stats


# ─── Bounce & Unsubscribe Handling ───────────────────────────────────

async def handle_bounce(email_id: str):
    """Handle a bounced email — mark prospect dead, cancel future emails."""
    from api.services.notify import _send_telegram_message, _esc_md

    notify_info = None

    async with async_session_factory() as db:
        email = await db.get(OutreachEmail, email_id)
        if not email:
            return

        email.status = "bounced"
        prospect = await db.get(DroneProspect, email.prospect_id)
        if prospect:
            # Cancel all future emails
            future = await db.execute(
                select(OutreachEmail)
                .where(
                    OutreachEmail.prospect_id == prospect.id,
                    OutreachEmail.status.in_(["draft", "approved", "scheduled"]),
                )
            )
            for fe in future.scalars().all():
                fe.status = "cancelled"

            prospect.status = "dead"
            prospect.notes = (prospect.notes or "") + f"\nBounced: {email.subject}"
            notify_info = (prospect.email, prospect.name)

        await db.commit()

    if notify_info:
        await _send_telegram_message(
            f"📬 *Bounce:* {_esc_md(notify_info[0])}\n"
            f"📋 {_esc_md(notify_info[1])} — marked dead"
        )


async def handle_unsubscribe(prospect_id: str):
    """Mark prospect as do_not_contact and cancel all pending emails."""
    from api.services.notify import _send_telegram_message, _esc_md

    async with async_session_factory() as db:
        prospect = await db.get(DroneProspect, prospect_id)
        if not prospect:
            return

        prospect.status = "do_not_contact"
        p_name = prospect.name

        # Cancel all non-sent emails
        result = await db.execute(
            select(OutreachEmail)
            .where(
                OutreachEmail.prospect_id == prospect.id,
                OutreachEmail.status.in_(["draft", "approved", "scheduled"]),
            )
        )
        for email in result.scalars().all():
            email.status = "cancelled"

        await db.commit()

    await _send_telegram_message(
        f"🚫 *Unsubscribe:* {_esc_md(p_name)} — marked do\\_not\\_contact"
    )


# ─── Batch Enqueue (for copywriter agent) ────────────────────────────

async def batch_enqueue_prospects(limit: int = 20) -> int:
    """
    Enqueue scored, un-contacted prospects for outreach.
    Targets prospects with emails, valid research hooks, ordered by priority.
    Relaxed from hot/warm-only to include any tier with a good hook.
    """
    async with async_session_factory() as db:
        result = await db.execute(
            select(DroneProspect.id).where(
                DroneProspect.email.isnot(None),
                DroneProspect.emails_sent == 0,
                DroneProspect.status == "scored",
            ).order_by(DroneProspect.priority_score.desc()).limit(limit)
        )
        ids = [str(r[0]) for r in result.fetchall()]

    count = 0
    for pid in ids:
        email_id = await enqueue_prospect(pid)
        if email_id:
            count += 1

    if count > 0:
        logger.info("Batch enqueued %d prospects for outreach", count)
        try:
            from api.services.notify import send_telegram_emails_pending
            await send_telegram_emails_pending(count)
        except Exception:
            pass

    return count
