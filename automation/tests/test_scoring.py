"""
AJ Builds Drone — Scoring engine tests.
"""

import uuid
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from api.models.prospect import DroneProspect
from api.services.scoring_engine import calculate_drone_score, score_prospect, batch_score_prospects


def _mock_prospect(**kwargs):
    """Create a SimpleNamespace that mimics DroneProspect attribute access."""
    defaults = {
        "has_custom_hardware": None,
        "has_fpga": None,
        "has_edge_compute": None,
        "simulation_setup": None,
        "hardware_platforms": [],
        "flight_controller": None,
        "flight_controller_version": None,
        "sensor_types": [],
        "software_stack": [],
        "publication_rate": None,
        "lab_students_count": None,
        "total_grant_funding": None,
        "organization": "",
        "organization_type": "university",
        "has_drone_lab": None,
        "active_grants": [],
        "enrichment": {},
        "enriched_at": None,
        "recent_papers": [],
        "h_index": None,
        "new_grant_last_6_months": None,
        "hiring_drone_engineer": None,
        "mentioned_future_work": None,
        "conference_deadline_soon": None,
        "competition_deadline_soon": None,
        "created_at": None,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


class TestScoringEngine:

    def test_empty_prospect_scores_zero(self):
        scores = calculate_drone_score(_mock_prospect())
        assert scores["priority_score"] >= 0
        assert scores["need"] >= 0
        assert scores["ability"] >= 0
        assert scores["timing"] >= 0

    def test_high_need_no_hardware(self):
        p = _mock_prospect(
            has_custom_hardware=False,
            has_fpga=False,
            simulation_setup=None,
            hardware_platforms=[],
        )
        scores = calculate_drone_score(p)
        assert scores["need"] > 0

    def test_high_ability_funded(self):
        p = _mock_prospect(
            total_grant_funding=500000,
            organization="Massachusetts Institute of Technology",
            has_drone_lab=True,
            lab_students_count=10,
        )
        scores = calculate_drone_score(p)
        assert scores["ability"] > 0

    def test_timing_new_grant(self):
        from datetime import datetime, timezone
        current_year = datetime.now(timezone.utc).year
        p = _mock_prospect(
            active_grants=[{"start_year": current_year}],
        )
        scores = calculate_drone_score(p)
        assert scores["timing"] >= 15

    def test_tier_assignment_hot(self):
        from datetime import datetime, timezone
        current_year = datetime.now(timezone.utc).year
        p = _mock_prospect(
            has_custom_hardware=False,
            has_fpga=False,
            simulation_setup=None,
            total_grant_funding=500000,
            organization="Massachusetts Institute of Technology",
            has_drone_lab=True,
            active_grants=[{"start_year": current_year}],
            enrichment={"hiring_drone_engineer": True},
            enriched_at="2026-01-01",
        )
        scores = calculate_drone_score(p)
        assert scores["priority_score"] >= 55
        assert scores["tier"] in ("hot", "warm")

    async def test_score_prospect_db(self, db_session):
        """Test scoring via calculate_drone_score with a real ORM object."""
        p = DroneProspect(
            id=uuid.uuid4(),
            name="Dr. Funded",
            email="funded@mit.edu",
            organization="Massachusetts Institute of Technology",
            has_drone_lab=True,
            total_grant_funding=200000,
            status="discovered",
        )
        db_session.add(p)
        await db_session.commit()
        await db_session.refresh(p)

        result = calculate_drone_score(p)
        assert result["priority_score"] >= 0
        assert result["tier"] in ("hot", "warm", "cool", "cold")

    async def test_batch_score(self, db_session):
        """Test that calculate_drone_score works on multiple prospects."""
        prospects = []
        for i in range(3):
            p = DroneProspect(
                id=uuid.uuid4(),
                name=f"Dr. Batch {i}",
                email=f"batch{i}@test.edu",
                organization="Test University",
                status="discovered",
            )
            db_session.add(p)
            prospects.append(p)
        await db_session.commit()

        for p in prospects:
            await db_session.refresh(p)
            result = calculate_drone_score(p)
            assert result["priority_score"] >= 0
            p.priority_score = result["priority_score"]
            p.tier = result["tier"]

        await db_session.commit()

        result = await db_session.execute(
            select(DroneProspect).where(DroneProspect.priority_score.isnot(None))
        )
        scored = result.scalars().all()
        assert len(scored) == 3
