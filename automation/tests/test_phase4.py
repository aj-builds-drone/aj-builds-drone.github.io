"""
Phase 4 tests — Drone cadence engine, email tracker, outreach routes.
"""

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from api.models.prospect import DroneProspect, OutreachEmail, LabAudit
from api.database import Base


def _make_session_factory(engine):
    return async_sessionmaker(engine, expire_on_commit=False)


def _patch_all_factories(session_factory):
    """Patch async_session_factory everywhere it's lazily imported."""
    return [
        patch("api.database.async_session_factory", session_factory),
        patch("api.services.drone_cadence_engine.async_session_factory", session_factory),
        patch("api.services.drone_template_engine.async_session_factory", session_factory),
    ]


# Shared in-memory DB so all connections see the same data
_SHARED_DB_URL = "sqlite+aiosqlite:///file:phase4test?mode=memory&cache=shared&uri=true"


@pytest_asyncio.fixture()
async def shared_engine():
    """Engine using shared-cache in-memory SQLite so multiple sessions see the same data."""
    from sqlalchemy.ext.asyncio import create_async_engine
    engine = create_async_engine(_SHARED_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


# ═══════════════════════════════════════════════════════════════════════
# Cadence Engine — Timing Tests
# ═══════════════════════════════════════════════════════════════════════


class TestSendWindows:

    def test_academic_send_windows_exist(self):
        from api.services.drone_cadence_engine import SEND_WINDOWS
        assert "university" in SEND_WINDOWS
        assert "research_lab" in SEND_WINDOWS
        assert "default" in SEND_WINDOWS

    def test_university_window_is_tue_thu(self):
        from api.services.drone_cadence_engine import SEND_WINDOWS
        w = SEND_WINDOWS["university"]
        assert w["days"] == [1, 2, 3]  # Tue, Wed, Thu
        assert w["hours"] == (13, 16)   # 9-12 ET in UTC

    def test_get_next_send_time_skips_weekends(self):
        from api.services.drone_cadence_engine import get_next_send_time
        # Saturday at noon UTC
        saturday = datetime(2025, 1, 4, 12, 0, tzinfo=timezone.utc)
        send_time = get_next_send_time("university", after=saturday)
        # Should schedule on next Tue/Wed/Thu
        assert send_time.weekday() in [1, 2, 3]
        assert send_time > saturday

    def test_get_next_send_time_respects_window_hours(self):
        from api.services.drone_cadence_engine import get_next_send_time
        # Tuesday at 2 AM UTC — before window
        tuesday_early = datetime(2025, 1, 7, 2, 0, tzinfo=timezone.utc)
        send_time = get_next_send_time("university", after=tuesday_early)
        assert send_time.hour >= 13  # Window starts at 13 UTC

    def test_blackout_december_finals(self):
        from api.services.drone_cadence_engine import _is_blackout
        assert _is_blackout(datetime(2025, 12, 15))
        assert _is_blackout(datetime(2025, 12, 25))
        assert not _is_blackout(datetime(2025, 12, 5))

    def test_blackout_may_finals(self):
        from api.services.drone_cadence_engine import _is_blackout
        assert _is_blackout(datetime(2025, 5, 5))
        assert not _is_blackout(datetime(2025, 5, 20))

    def test_get_next_send_time_skips_blackout(self):
        from api.services.drone_cadence_engine import get_next_send_time
        # Dec 12 Tuesday at 14:00 UTC — in blackout
        blackout_day = datetime(2025, 12, 16, 14, 0, tzinfo=timezone.utc)
        send_time = get_next_send_time("university", after=blackout_day)
        # Should skip past Dec 31
        assert send_time.month == 1 or send_time.day > 31


class TestStepDelays:

    def test_step_delays(self):
        from api.services.drone_cadence_engine import STEP_DELAYS
        assert STEP_DELAYS[1] == 0     # Immediate
        assert STEP_DELAYS[2] == 3     # 3 days
        assert STEP_DELAYS[3] == 7     # 1 week
        assert STEP_DELAYS[4] == 21    # 3 weeks
        assert STEP_DELAYS[5] == 90    # 3 months (resurrection)


class TestBlockedEmail:

    def test_empty_email_blocked(self):
        from api.services.drone_cadence_engine import _is_blocked_email
        assert _is_blocked_email("")
        assert _is_blocked_email(None)

    def test_noreply_blocked(self):
        from api.services.drone_cadence_engine import _is_blocked_email
        assert _is_blocked_email("noreply@mit.edu")
        assert _is_blocked_email("no-reply@stanford.edu")

    def test_valid_email_not_blocked(self):
        from api.services.drone_cadence_engine import _is_blocked_email
        assert not _is_blocked_email("professor@mit.edu")
        assert not _is_blocked_email("john.doe@stanford.edu")

    def test_support_email_blocked(self):
        from api.services.drone_cadence_engine import _is_blocked_email
        assert _is_blocked_email("support@university.edu")
        assert _is_blocked_email("admin@lab.edu")


# ═══════════════════════════════════════════════════════════════════════
# Cadence Engine — DB Tests
# ═══════════════════════════════════════════════════════════════════════


class TestEnqueueProspect:

    @pytest.mark.asyncio
    async def test_enqueue_creates_draft(self, shared_engine):
        """Enqueue should create an email with status=draft."""
        sf = _make_session_factory(shared_engine)
        pid = uuid.uuid4()

        async with sf() as s:
            p = DroneProspect(
                id=pid,
                name="Dr. Test Professor",
                organization="MIT",
                organization_type="university",
                email="professor@mit.edu",
                status="scored",
                tier="hot",
                priority_score=85,
                audited_at=datetime.now(timezone.utc),
            )
            s.add(p)
            await s.commit()

        patches = _patch_all_factories(sf)
        for p_ in patches:
            p_.start()
        try:
            from api.services.drone_cadence_engine import enqueue_prospect
            email_id = await enqueue_prospect(str(pid))
        finally:
            for p_ in patches:
                p_.stop()

        assert email_id is not None

        async with sf() as s:
            result = await s.execute(
                select(OutreachEmail).where(OutreachEmail.prospect_id == str(pid))
            )
            email = result.scalar_one()
            assert email.status == "draft"
            assert email.sequence_step == 1
            assert email.tracking_id is not None
            assert email.subject

    @pytest.mark.asyncio
    async def test_enqueue_skips_no_email(self, shared_engine):
        """Prospects without email should not be enqueued."""
        sf = _make_session_factory(shared_engine)
        pid = uuid.uuid4()

        async with sf() as s:
            p = DroneProspect(id=pid, name="No Email Prof", organization="MIT", status="scored")
            s.add(p)
            await s.commit()

        patches = _patch_all_factories(sf)
        for p_ in patches:
            p_.start()
        try:
            from api.services.drone_cadence_engine import enqueue_prospect
            result = await enqueue_prospect(str(pid))
        finally:
            for p_ in patches:
                p_.stop()
        assert result is None

    @pytest.mark.asyncio
    async def test_enqueue_skips_contacted(self, shared_engine):
        """Already-contacted prospects should not be re-enqueued."""
        sf = _make_session_factory(shared_engine)
        pid = uuid.uuid4()

        async with sf() as s:
            p = DroneProspect(
                id=pid, name="Already Contacted", organization="CMU",
                email="prof@cmu.edu", status="contacted",
            )
            s.add(p)
            await s.commit()

        patches = _patch_all_factories(sf)
        for p_ in patches:
            p_.start()
        try:
            from api.services.drone_cadence_engine import enqueue_prospect
            result = await enqueue_prospect(str(pid))
        finally:
            for p_ in patches:
                p_.stop()
        assert result is None

    @pytest.mark.asyncio
    async def test_enqueue_prevents_duplicate_step1(self, shared_engine):
        """Should not create a second step-1 email."""
        sf = _make_session_factory(shared_engine)
        pid = uuid.uuid4()

        async with sf() as s:
            p = DroneProspect(
                id=pid, name="Dup Test Prof", organization="Stanford",
                email="prof@stanford.edu", status="queued",
            )
            s.add(p)
            e = OutreachEmail(
                id=uuid.uuid4(), prospect_id=pid, sequence_step=1,
                subject="Test", body_html="<p>Test</p>", body_text="Test",
                status="draft",
            )
            s.add(e)
            await s.commit()

        patches = _patch_all_factories(sf)
        for p_ in patches:
            p_.start()
        try:
            from api.services.drone_cadence_engine import enqueue_prospect
            result = await enqueue_prospect(str(pid))
        finally:
            for p_ in patches:
                p_.stop()
        assert result is None


class TestScheduleNextStep:

    @pytest.mark.asyncio
    async def test_schedule_step2(self, shared_engine):
        """After step 1, should create step 2 draft."""
        sf = _make_session_factory(shared_engine)
        pid = uuid.uuid4()

        async with sf() as s:
            p = DroneProspect(
                id=pid, name="Dr. Step Test", organization="Georgia Tech",
                organization_type="university", email="prof@gatech.edu",
                status="contacted", emails_sent=1,
            )
            s.add(p)
            await s.commit()

        patches = _patch_all_factories(sf)
        for p_ in patches:
            p_.start()
        try:
            from api.services.drone_cadence_engine import schedule_next_step
            email_id = await schedule_next_step(str(pid), current_step=1)
        finally:
            for p_ in patches:
                p_.stop()

        assert email_id is not None

        async with sf() as s:
            result = await s.execute(
                select(OutreachEmail).where(
                    OutreachEmail.prospect_id == str(pid),
                    OutreachEmail.sequence_step == 2,
                )
            )
            email = result.scalar_one()
            assert email.status == "draft"
            assert email.sequence_step == 2

    @pytest.mark.asyncio
    async def test_no_step_6(self, shared_engine):
        """Should not create step 6 — sequence is 5 steps."""
        sf = _make_session_factory(shared_engine)
        pid = uuid.uuid4()

        async with sf() as s:
            p = DroneProspect(
                id=pid, name="End of Sequence", organization="CalTech",
                email="prof@caltech.edu", status="follow_up_3",
            )
            s.add(p)
            await s.commit()

        patches = _patch_all_factories(sf)
        for p_ in patches:
            p_.start()
        try:
            from api.services.drone_cadence_engine import schedule_next_step
            result = await schedule_next_step(str(pid), current_step=5)
        finally:
            for p_ in patches:
                p_.stop()
        assert result is None

    @pytest.mark.asyncio
    async def test_skip_resurrection_no_opens(self, shared_engine):
        """Step 5 (resurrection) should be skipped if prospect never opened."""
        sf = _make_session_factory(shared_engine)
        pid = uuid.uuid4()

        async with sf() as s:
            p = DroneProspect(
                id=pid, name="Never Opened", organization="Princeton",
                email="prof@princeton.edu", status="follow_up_3", emails_opened=0,
            )
            s.add(p)
            await s.commit()

        patches = _patch_all_factories(sf)
        for p_ in patches:
            p_.start()
        try:
            from api.services.drone_cadence_engine import schedule_next_step
            result = await schedule_next_step(str(pid), current_step=4)
        finally:
            for p_ in patches:
                p_.stop()
        assert result is None

    @pytest.mark.asyncio
    async def test_skip_if_replied(self, shared_engine):
        """Should not schedule next step if prospect replied."""
        sf = _make_session_factory(shared_engine)
        pid = uuid.uuid4()

        async with sf() as s:
            p = DroneProspect(
                id=pid, name="Replied Prof", organization="Harvard",
                email="prof@harvard.edu", status="replied",
            )
            s.add(p)
            await s.commit()

        patches = _patch_all_factories(sf)
        for p_ in patches:
            p_.start()
        try:
            from api.services.drone_cadence_engine import schedule_next_step
            result = await schedule_next_step(str(pid), current_step=1)
        finally:
            for p_ in patches:
                p_.stop()
        assert result is None


# ═══════════════════════════════════════════════════════════════════════
# Email Tracker Tests
# ═══════════════════════════════════════════════════════════════════════


class TestTrackingInjection:

    def test_inject_tracking_pixel(self):
        from api.services.email_tracker import inject_tracking
        html = '<html><body><p>Hello</p><img src="__TRACKING_PIXEL_URL__"></body></html>'
        result = inject_tracking(html, "test-tracking-id")
        assert "test-tracking-id" in result
        assert "__TRACKING_PIXEL_URL__" not in result
        assert "open.html" in result

    def test_inject_unsubscribe_url(self):
        from api.services.email_tracker import inject_tracking
        html = '<a href="__UNSUBSCRIBE_URL__">Unsubscribe</a>'
        result = inject_tracking(html, "test-id")
        assert "unsubscribe.html?t=test-id" in result

    def test_rewrite_links_for_click_tracking(self):
        from api.services.email_tracker import inject_tracking
        html = '<a href="https://example.com/paper">Read paper</a>'
        result = inject_tracking(html, "t123")
        assert "click.html" in result
        assert "t123" in result
        assert "example.com" in result

    def test_skip_mailto_links(self):
        from api.services.email_tracker import inject_tracking
        html = '<a href="mailto:test@test.com">Email</a>'
        result = inject_tracking(html, "t123")
        assert "mailto:test@test.com" in result
        assert "click.html" not in result

    def test_skip_own_domain_links(self):
        from api.services.email_tracker import inject_tracking
        html = '<a href="https://ajayadesign.github.io/portfolio">Portfolio</a>'
        result = inject_tracking(html, "t123")
        # Should NOT rewrite our own domain
        assert 'href="https://ajayadesign.github.io/portfolio"' in result

    def test_no_tracking_without_id(self):
        from api.services.email_tracker import inject_tracking
        html = '<p>Hello __TRACKING_PIXEL_URL__ and __UNSUBSCRIBE_URL__</p>'
        result = inject_tracking(html, "")
        # No tracking ID → return unchanged
        assert result == html


class TestTrackingUrls:

    def test_pixel_url(self):
        from api.services.email_tracker import get_tracking_pixel_url
        url = get_tracking_pixel_url("abc123")
        assert "abc123" in url
        assert "open.html" in url

    def test_click_url(self):
        from api.services.email_tracker import get_click_tracking_url
        url = get_click_tracking_url("abc123", "https://example.com")
        assert "abc123" in url
        assert "click.html" in url
        assert "example.com" in url

    def test_unsubscribe_url(self):
        from api.services.email_tracker import get_unsubscribe_url
        url = get_unsubscribe_url("abc123")
        assert "abc123" in url
        assert "unsubscribe" in url


class TestRecordOpen:

    @pytest.mark.asyncio
    async def test_record_open_updates_email(self, shared_engine):
        sf = _make_session_factory(shared_engine)
        pid = uuid.uuid4()

        async with sf() as s:
            p = DroneProspect(
                id=pid, name="Open Test", organization="MIT",
                email="prof@mit.edu", status="contacted",
            )
            s.add(p)
            e = OutreachEmail(
                id=uuid.uuid4(), prospect_id=pid, sequence_step=1,
                subject="Test", body_html="<p>Hi</p>", body_text="Hi", status="sent",
                tracking_id="open-track-123",
            )
            s.add(e)
            await s.commit()

        with patch("api.database.async_session_factory", sf):
            from api.services.email_tracker import record_open
            result = await record_open("open-track-123")

        assert result is True

        async with sf() as s:
            r = await s.execute(select(OutreachEmail).where(OutreachEmail.tracking_id == "open-track-123"))
            email = r.scalar_one()
            assert email.opened_at is not None
            assert email.open_count == 1

    @pytest.mark.asyncio
    async def test_record_open_unknown_id(self, shared_engine):
        sf = _make_session_factory(shared_engine)
        with patch("api.database.async_session_factory", sf):
            from api.services.email_tracker import record_open
            result = await record_open("nonexistent-id")
        assert result is False


class TestRecordClick:

    @pytest.mark.asyncio
    async def test_record_click_updates_email(self, shared_engine):
        sf = _make_session_factory(shared_engine)
        pid = uuid.uuid4()

        async with sf() as s:
            p = DroneProspect(
                id=pid, name="Click Test", organization="CMU",
                email="prof@cmu.edu", status="contacted",
            )
            s.add(p)
            e = OutreachEmail(
                id=uuid.uuid4(), prospect_id=pid, sequence_step=1,
                subject="Test", body_html="<p>Hi</p>", body_text="Hi", status="sent",
                tracking_id="click-track-456",
            )
            s.add(e)
            await s.commit()

        with patch("api.database.async_session_factory", sf):
            from api.services.email_tracker import record_click
            result = await record_click("click-track-456", "https://example.com/paper")

        assert result is True

        async with sf() as s:
            r = await s.execute(select(OutreachEmail).where(OutreachEmail.tracking_id == "click-track-456"))
            email = r.scalar_one()
            assert email.clicked_at is not None
            assert email.click_count == 1


# ═══════════════════════════════════════════════════════════════════════
# Route Tests — Email Queue
# ═══════════════════════════════════════════════════════════════════════


class TestEmailQueueRoutes:

    @pytest.mark.asyncio
    async def test_list_empty_queue(self, client):
        resp = await client.get("/outreach/email-queue")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["pending"] == []

    @pytest.mark.asyncio
    async def test_list_draft_emails(self, client, db_session):
        p = DroneProspect(
            id=uuid.uuid4(), name="Queue Test Prof", organization="MIT",
            email="queue@mit.edu", status="queued",
        )
        db_session.add(p)

        e = OutreachEmail(
            id=uuid.uuid4(), prospect_id=p.id, sequence_step=1,
            subject="Queue Test", body_html="<p>Test</p>", body_text="Test",
            template_id="lab_capability_audit.html",
            personalization={"name": "Test"},
            status="draft",
        )
        db_session.add(e)
        await db_session.commit()

        resp = await client.get("/outreach/email-queue")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        item = data["pending"][0]
        assert item["to_email"] == "queue@mit.edu"
        assert item["to_name"] == "Queue Test Prof"
        assert item["template_id"] == "lab_capability_audit.html"
        assert item["sequence_step"] == 1

    @pytest.mark.asyncio
    async def test_approve_email_marks_approved(self, client, db_session):
        p = DroneProspect(
            id=uuid.uuid4(), name="Approve Test", organization="MIT",
            email="approve@mit.edu", status="queued",
        )
        db_session.add(p)

        e = OutreachEmail(
            id=uuid.uuid4(), prospect_id=p.id, sequence_step=1,
            subject="Approve Test", body_html="<p>Approve</p>", body_text="Approve",
            status="draft",
            scheduled_for=datetime(2099, 1, 1, tzinfo=timezone.utc),  # Far future
        )
        db_session.add(e)
        await db_session.commit()

        resp = await client.post(f"/outreach/email-queue/{e.id}/approve")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "approved" in data["message"].lower()

        await db_session.refresh(e)
        assert e.status == "approved"

    @pytest.mark.asyncio
    async def test_reject_email(self, client, db_session):
        p = DroneProspect(
            id=uuid.uuid4(), name="Reject Test", organization="MIT",
            email="reject@mit.edu", status="queued",
        )
        db_session.add(p)

        e = OutreachEmail(
            id=uuid.uuid4(), prospect_id=p.id, sequence_step=1,
            subject="Reject Test", body_html="<p>Reject</p>", body_text="Reject",
            status="draft",
        )
        db_session.add(e)
        await db_session.commit()

        resp = await client.post(f"/outreach/email-queue/{e.id}/reject")
        assert resp.status_code == 200

        await db_session.refresh(e)
        assert e.status == "rejected"

    @pytest.mark.asyncio
    async def test_approve_non_draft_fails(self, client, db_session):
        p = DroneProspect(
            id=uuid.uuid4(), name="Already Sent", organization="MIT",
            email="sent@mit.edu", status="contacted",
        )
        db_session.add(p)

        e = OutreachEmail(
            id=uuid.uuid4(), prospect_id=p.id, sequence_step=1,
            subject="Already Sent", body_html="<p>Sent</p>", body_text="Sent",
            status="sent",
        )
        db_session.add(e)
        await db_session.commit()

        resp = await client.post(f"/outreach/email-queue/{e.id}/approve")
        assert resp.status_code == 400


# ═══════════════════════════════════════════════════════════════════════
# Route Tests — Tracking Endpoints
# ═══════════════════════════════════════════════════════════════════════


class TestTrackingRoutes:

    @pytest.mark.asyncio
    async def test_open_tracking_returns_pixel(self, client):
        with patch("api.services.email_tracker.record_open", new_callable=AsyncMock, return_value=True):
            resp = await client.get("/outreach/track/open/any-tracking-id")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "image/png"

    @pytest.mark.asyncio
    async def test_click_tracking_redirects(self, client):
        with patch("api.services.email_tracker.record_click", new_callable=AsyncMock, return_value=True):
            resp = await client.get(
                "/outreach/track/click/any-tracking-id",
                params={"url": "https://example.com/paper"},
                follow_redirects=False,
            )
        assert resp.status_code == 302
        assert "example.com/paper" in resp.headers.get("location", "")

    @pytest.mark.asyncio
    async def test_click_tracking_rejects_non_http(self, client):
        with patch("api.services.email_tracker.record_click", new_callable=AsyncMock, return_value=True):
            resp = await client.get(
                "/outreach/track/click/some-id",
                params={"url": "javascript:alert(1)"},
            )
        assert resp.status_code == 400


# ═══════════════════════════════════════════════════════════════════════
# Bounce & Unsubscribe Tests
# ═══════════════════════════════════════════════════════════════════════


class TestBounceHandling:

    @pytest.mark.asyncio
    async def test_handle_bounce_marks_dead(self, shared_engine):
        sf = _make_session_factory(shared_engine)
        pid = uuid.uuid4()
        eid = uuid.uuid4()
        eid2 = uuid.uuid4()

        async with sf() as s:
            p = DroneProspect(
                id=pid, name="Bounce Prof", organization="MIT",
                email="bounce@mit.edu", status="contacted",
            )
            s.add(p)
            e = OutreachEmail(
                id=eid, prospect_id=pid, sequence_step=1,
                subject="Bounce Test", body_html="<p>Hi</p>", body_text="Hi",
                status="sent",
            )
            s.add(e)
            e2 = OutreachEmail(
                id=eid2, prospect_id=pid, sequence_step=2,
                subject="Follow up", body_html="<p>Follow up</p>", body_text="Follow up",
                status="draft",
            )
            s.add(e2)
            await s.commit()

        with patch("api.services.drone_cadence_engine.async_session_factory", sf):
            from api.services.drone_cadence_engine import handle_bounce
            await handle_bounce(str(eid))

        async with sf() as s:
            prospect = await s.get(DroneProspect, pid)
            assert prospect.status == "dead"
            email2 = await s.get(OutreachEmail, eid2)
            assert email2.status == "cancelled"


class TestUnsubscribeHandling:

    @pytest.mark.asyncio
    async def test_handle_unsubscribe(self, shared_engine):
        sf = _make_session_factory(shared_engine)
        pid = uuid.uuid4()
        eid = uuid.uuid4()

        async with sf() as s:
            p = DroneProspect(
                id=pid, name="Unsub Prof", organization="MIT",
                email="unsub@mit.edu", status="contacted",
            )
            s.add(p)
            e = OutreachEmail(
                id=eid, prospect_id=pid, sequence_step=2,
                subject="Follow up", body_html="<p>Follow up</p>", body_text="Follow up",
                status="approved",
            )
            s.add(e)
            await s.commit()

        with patch("api.services.drone_cadence_engine.async_session_factory", sf):
            from api.services.drone_cadence_engine import handle_unsubscribe
            await handle_unsubscribe(str(pid))

        async with sf() as s:
            prospect = await s.get(DroneProspect, pid)
            assert prospect.status == "do_not_contact"
            email = await s.get(OutreachEmail, eid)
            assert email.status == "cancelled"


# ═══════════════════════════════════════════════════════════════════════
# Scheduler Integration Tests
# ═══════════════════════════════════════════════════════════════════════


class TestSchedulerRegistration:

    def test_cadence_agents_registered(self):
        from api.agents.scheduler import register_all_agents, scheduler
        register_all_agents()
        assert "cadence_sender" in scheduler.agents
        assert "prospect_enqueue" in scheduler.agents
        # Cadence sender should run frequently (every 15 min)
        assert scheduler.agents["cadence_sender"].interval == 15 * 60

    def test_all_agents_count(self):
        from api.agents.scheduler import register_all_agents, scheduler
        register_all_agents()
        # Phase 1-4: 11 total agents
        assert len(scheduler.agents) >= 11
