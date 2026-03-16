"""
AJ Builds Drone — Model creation tests.
"""

import uuid

import pytest
from sqlalchemy import select

from api.models.prospect import DroneProspect, LabAudit, OutreachEmail, OutreachSequence, ProspectActivity, DiscoveryBatch
from api.models.contract import Contract, Invoice
from api.models.activity_log import ActivityLog


class TestDroneProspect:

    async def test_create_prospect(self, db_session):
        p = DroneProspect(
            id=uuid.uuid4(),
            name="Dr. Jane Smith",
            email="jsmith@mit.edu",
            organization="MIT",
            department="Aerospace Engineering",
            title="Associate Professor",
            source="google_scholar",
            status="discovered",
        )
        db_session.add(p)
        await db_session.commit()

        result = await db_session.execute(select(DroneProspect).where(DroneProspect.email == "jsmith@mit.edu"))
        loaded = result.scalar_one()
        assert loaded.name == "Dr. Jane Smith"
        assert loaded.organization == "MIT"
        assert loaded.source == "google_scholar"

    async def test_prospect_scoring_fields(self, db_session):
        p = DroneProspect(
            id=uuid.uuid4(),
            name="Dr. Bob",
            email="bob@stanford.edu",
            organization="Stanford",
            need_score=30,
            ability_score=25,
            timing_score=20,
            priority_score=75,
            tier="hot",
        )
        db_session.add(p)
        await db_session.commit()

        result = await db_session.execute(select(DroneProspect).where(DroneProspect.email == "bob@stanford.edu"))
        loaded = result.scalar_one()
        assert loaded.priority_score == 75
        assert loaded.tier == "hot"
        assert loaded.need_score == 30

    async def test_prospect_to_list_item(self, db_session):
        p = DroneProspect(
            id=uuid.uuid4(),
            name="Dr. Alice",
            email="alice@cmu.edu",
            organization="CMU",
            priority_score=60,
            tier="warm",
            status="enriched",
        )
        db_session.add(p)
        await db_session.commit()

        item = p.to_list_item()
        assert item["name"] == "Dr. Alice"
        assert item["tier"] == "warm"


class TestOutreachSequence:

    async def test_create_sequence(self, db_session):
        seq = OutreachSequence(
            id=uuid.uuid4(),
            name="Test Sequence",
            segment_tag="university",
            steps=[
                {"step": 1, "delay_days": 0, "template": "lab_capability_audit"},
                {"step": 2, "delay_days": 3, "template": "technical_value"},
            ],
        )
        db_session.add(seq)
        await db_session.commit()

        result = await db_session.execute(select(OutreachSequence))
        loaded = result.scalar_one()
        assert loaded.name == "Test Sequence"
        assert len(loaded.steps) == 2


class TestOutreachEmail:

    async def test_create_draft_email(self, db_session):
        pid = uuid.uuid4()
        p = DroneProspect(id=pid, name="Prof Test", email="prof@test.edu", organization="Test University", status="discovered")
        db_session.add(p)
        await db_session.flush()

        email = OutreachEmail(
            id=uuid.uuid4(),
            prospect_id=pid,
            subject="Lab Capability Analysis",
            body_html="<p>Test</p>",
            body_text="Test",
            template_id="lab_capability_audit",
            sequence_step=1,
            status="draft",  # CRITICAL: starts as draft, not sent
        )
        db_session.add(email)
        await db_session.commit()

        result = await db_session.execute(select(OutreachEmail))
        loaded = result.scalar_one()
        assert loaded.status == "draft"
        assert loaded.subject == "Lab Capability Analysis"


class TestContract:

    async def test_create_contract(self, db_session):
        c = Contract(
            id=uuid.uuid4(),
            short_id="abc12345",
            client_name="Test Client",
            client_email="client@test.com",
            project_name="Drone Build",
            total_amount=5000,
            status="draft",
            sign_token=uuid.uuid4().hex,
        )
        db_session.add(c)
        await db_session.commit()

        result = await db_session.execute(select(Contract).where(Contract.short_id == "abc12345"))
        loaded = result.scalar_one()
        assert loaded.project_name == "Drone Build"
        assert loaded.status == "draft"


class TestInvoice:

    async def test_create_invoice(self, db_session):
        inv = Invoice(
            id=uuid.uuid4(),
            invoice_number="DRONE-INV-001",
            client_name="Test Client",
            client_email="client@test.com",
            total_amount=2500,
            items=[{"description": "Custom PCB design", "quantity": 1, "unit_price": 2500, "amount": 2500}],
            status="draft",
        )
        db_session.add(inv)
        await db_session.commit()

        result = await db_session.execute(select(Invoice).where(Invoice.invoice_number == "DRONE-INV-001"))
        loaded = result.scalar_one()
        assert loaded.total_amount == 2500
        assert len(loaded.items) == 1


class TestDiscoveryBatch:

    async def test_create_batch(self, db_session):
        batch = DiscoveryBatch(
            id=uuid.uuid4(),
            source="google_scholar",
            query="UAV FPGA navigation",
            status="completed",
            prospects_found=15,
            prospects_new=8,
        )
        db_session.add(batch)
        await db_session.commit()

        result = await db_session.execute(select(DiscoveryBatch))
        loaded = result.scalar_one()
        assert loaded.source == "google_scholar"
        assert loaded.prospects_found == 15
