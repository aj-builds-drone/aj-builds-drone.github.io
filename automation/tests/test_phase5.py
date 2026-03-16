"""
AJ Builds Drone — Phase 5 Tests: Dashboard & Polish.

Tests for:
- Dashboard HTML serving
- Campaign analytics API
- Map data API
- Prospect detail API
- Activity feed API
- Telegram reply notification
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from sqlalchemy import select

from api.models.prospect import DroneProspect, OutreachEmail, LabAudit
from api.models.activity_log import ActivityLog


# ═══════════════════════════════════════════════════════════════════════
# Dashboard HTML
# ═══════════════════════════════════════════════════════════════════════

class TestDashboardServing:

    @pytest.mark.asyncio
    async def test_dashboard_returns_html(self, client):
        resp = await client.get("/dashboard")
        assert resp.status_code == 200
        assert "text/html" in resp.headers["content-type"]
        assert "Command Center" in resp.text

    @pytest.mark.asyncio
    async def test_dashboard_has_tabs(self, client):
        resp = await client.get("/dashboard")
        assert "tab-overview" in resp.text
        assert "tab-map" in resp.text
        assert "tab-analytics" in resp.text
        assert "tab-queue" in resp.text
        assert "tab-prospects" in resp.text

    @pytest.mark.asyncio
    async def test_dashboard_has_leaflet(self, client):
        resp = await client.get("/dashboard")
        assert "leaflet" in resp.text.lower()

    @pytest.mark.asyncio
    async def test_dashboard_has_chartjs(self, client):
        resp = await client.get("/dashboard")
        assert "chart.js" in resp.text.lower() or "Chart" in resp.text


# ═══════════════════════════════════════════════════════════════════════
# Campaign Analytics API
# ═══════════════════════════════════════════════════════════════════════

class TestCampaignAnalytics:

    @pytest.mark.asyncio
    async def test_analytics_empty(self, client):
        resp = await client.get("/dashboard/analytics/campaign")
        assert resp.status_code == 200
        data = resp.json()
        assert "by_org_type" in data
        assert "by_step" in data
        assert "by_template" in data
        assert "daily_volume" in data

    @pytest.mark.asyncio
    async def test_analytics_with_data(self, client, db_session):
        pid = uuid.uuid4()
        p = DroneProspect(
            id=pid, name="Analytics Prof", organization="MIT",
            organization_type="university", email="prof@mit.edu",
            status="contacted",
        )
        db_session.add(p)

        e = OutreachEmail(
            id=uuid.uuid4(), prospect_id=pid, sequence_step=1,
            subject="Test", body_html="<p>Test</p>", body_text="Test",
            template_id="lab_capability_audit",
            status="sent", sent_at=datetime.now(timezone.utc),
            opened_at=datetime.now(timezone.utc), open_count=2,
        )
        db_session.add(e)
        await db_session.commit()

        resp = await client.get("/dashboard/analytics/campaign")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["by_org_type"]) >= 1
        uni = next((r for r in data["by_org_type"] if r["org_type"] == "university"), None)
        assert uni is not None
        assert uni["sent"] >= 1
        assert uni["opened"] >= 1

    @pytest.mark.asyncio
    async def test_analytics_by_step(self, client, db_session):
        pid = uuid.uuid4()
        p = DroneProspect(
            id=pid, name="Step Prof", organization="CMU",
            organization_type="university", email="step@cmu.edu",
            status="contacted",
        )
        db_session.add(p)
        for step in [1, 2]:
            e = OutreachEmail(
                id=uuid.uuid4(), prospect_id=pid, sequence_step=step,
                subject=f"Step {step}", body_html="<p>S</p>", body_text="S",
                status="sent", sent_at=datetime.now(timezone.utc),
            )
            db_session.add(e)
        await db_session.commit()

        resp = await client.get("/dashboard/analytics/campaign")
        data = resp.json()
        assert len(data["by_step"]) >= 2


# ═══════════════════════════════════════════════════════════════════════
# Map Data API
# ═══════════════════════════════════════════════════════════════════════

class TestMapData:

    @pytest.mark.asyncio
    async def test_map_data_empty(self, client):
        resp = await client.get("/dashboard/map-data")
        assert resp.status_code == 200
        data = resp.json()
        assert data["markers"] == []
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_map_data_with_coords(self, client, db_session):
        p = DroneProspect(
            id=uuid.uuid4(), name="Map Prof", organization="Georgia Tech",
            organization_type="university", email="map@gatech.edu",
            status="scored", tier="hot", priority_score=85,
            lat=Decimal("33.7756178"), lng=Decimal("-84.3962707"),
            city="Atlanta", state="GA",
        )
        db_session.add(p)
        await db_session.commit()

        resp = await client.get("/dashboard/map-data")
        data = resp.json()
        assert data["total"] == 1
        marker = data["markers"][0]
        assert marker["name"] == "Map Prof"
        assert marker["org"] == "Georgia Tech"
        assert marker["tier"] == "hot"
        assert abs(marker["lat"] - 33.7756) < 0.01
        assert abs(marker["lng"] - (-84.396)) < 0.01
        assert marker["city"] == "Atlanta"
        assert marker["state"] == "GA"

    @pytest.mark.asyncio
    async def test_map_data_excludes_no_coords(self, client, db_session):
        p = DroneProspect(
            id=uuid.uuid4(), name="No Coords Prof", organization="Stanford",
            email="no@stanford.edu", status="scored",
        )
        db_session.add(p)
        await db_session.commit()

        resp = await client.get("/dashboard/map-data")
        assert resp.json()["total"] == 0


# ═══════════════════════════════════════════════════════════════════════
# Prospect Detail API
# ═══════════════════════════════════════════════════════════════════════

class TestProspectDetail:

    @pytest.mark.asyncio
    async def test_prospect_not_found(self, client):
        fake_id = str(uuid.uuid4())
        resp = await client.get(f"/dashboard/prospect/{fake_id}")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_prospect_detail_full(self, client, db_session):
        pid = uuid.uuid4()
        p = DroneProspect(
            id=pid, name="Dr. Detail", organization="MIT",
            organization_type="university", email="detail@mit.edu",
            department="CSAIL", title="Associate Professor",
            status="contacted", tier="hot", priority_score=92,
            h_index=25, total_citations=1200,
            city="Cambridge", state="MA", country="US",
        )
        db_session.add(p)

        audit = LabAudit(
            id=uuid.uuid4(), prospect_id=pid,
            hardware_score=70, software_score=80,
            research_score=90, overall_score=80,
            competitive_gap="No FPGA capability",
            recommendations=["Add Xilinx Zynq dev board"],
        )
        db_session.add(audit)

        email = OutreachEmail(
            id=uuid.uuid4(), prospect_id=pid, sequence_step=1,
            subject="Lab Audit", body_html="<p>Hi</p>", body_text="Hi",
            status="sent", sent_at=datetime.now(timezone.utc),
            opened_at=datetime.now(timezone.utc), open_count=3,
        )
        db_session.add(email)
        await db_session.commit()

        resp = await client.get(f"/dashboard/prospect/{pid}")
        assert resp.status_code == 200
        data = resp.json()

        assert data["profile"]["name"] == "Dr. Detail"
        assert data["profile"]["organization"] == "MIT"
        assert data["profile"]["h_index"] == 25

        assert len(data["audits"]) == 1
        assert data["audits"][0]["overall_score"] == 80

        assert len(data["emails"]) == 1
        assert data["emails"][0]["step"] == 1
        assert data["emails"][0]["open_count"] == 3


# ═══════════════════════════════════════════════════════════════════════
# Activity Feed API
# ═══════════════════════════════════════════════════════════════════════

class TestActivityFeed:

    @pytest.mark.asyncio
    async def test_activity_feed_empty(self, client):
        resp = await client.get("/dashboard/activity-feed")
        assert resp.status_code == 200
        data = resp.json()
        assert data["activities"] == []

    @pytest.mark.asyncio
    async def test_activity_feed_with_data(self, client, db_session):
        a = ActivityLog(
            id=uuid.uuid4(), entity_type="prospect",
            entity_id=str(uuid.uuid4()), action="scored",
            description="Prospect scored: 85 (hot)",
            icon="🎯", actor="scheduler",
        )
        db_session.add(a)
        await db_session.commit()

        resp = await client.get("/dashboard/activity-feed")
        data = resp.json()
        assert len(data["activities"]) == 1
        assert data["activities"][0]["action"] == "scored"
        assert data["activities"][0]["icon"] == "🎯"

    @pytest.mark.asyncio
    async def test_activity_feed_limit(self, client):
        resp = await client.get("/dashboard/activity-feed?limit=5")
        assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════════════
# Telegram Reply Notification
# ═══════════════════════════════════════════════════════════════════════

class TestTelegramReplyNotification:

    @pytest.mark.asyncio
    async def test_send_reply_notification(self):
        with patch("api.services.notify._send_telegram_message", new_callable=AsyncMock, return_value=True) as mock_tg:
            from api.services.notify import send_telegram_reply_received
            result = await send_telegram_reply_received(
                name="Dr. Smith", org="MIT",
                subject="Re: Lab Capability Audit",
                sentiment="positive",
            )
            assert result is True
            mock_tg.assert_called_once()
            msg = mock_tg.call_args[0][0]
            assert "Reply received" in msg
            assert "Dr" in msg
            assert "MIT" in msg

    @pytest.mark.asyncio
    async def test_reply_notification_sentiment_emoji(self):
        with patch("api.services.notify._send_telegram_message", new_callable=AsyncMock, return_value=True) as mock_tg:
            from api.services.notify import send_telegram_reply_received
            await send_telegram_reply_received("Prof", "CMU", "Re: Test", "objection")
            msg = mock_tg.call_args[0][0]
            assert "⚠️" in msg

    @pytest.mark.asyncio
    async def test_reply_notification_no_sentiment(self):
        with patch("api.services.notify._send_telegram_message", new_callable=AsyncMock, return_value=True) as mock_tg:
            from api.services.notify import send_telegram_reply_received
            await send_telegram_reply_received("Prof", "Stanford", "Re: Audit", "")
            msg = mock_tg.call_args[0][0]
            assert "💬" in msg


# ═══════════════════════════════════════════════════════════════════════
# Root Endpoint Version
# ═══════════════════════════════════════════════════════════════════════

class TestRootVersion:

    @pytest.mark.asyncio
    async def test_root_version_3(self, client):
        resp = await client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["version"] == "4.0.0"
