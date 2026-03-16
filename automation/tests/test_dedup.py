"""
AJ Builds Drone — De-duplication engine tests.
"""

import uuid

import pytest
from sqlalchemy import select

from api.models.prospect import DroneProspect
from api.services.dedup_engine import (
    _normalize_name,
    _normalize_org,
    _richness_score,
    _merge_lists,
    _pick_best,
    _merge_pair,
)


class TestDedupHelpers:

    def test_normalize_name(self):
        assert _normalize_name("Dr. Sarah Chen") == "sarah chen"
        assert _normalize_name("Prof. Bob Smith") == "bob smith"
        assert _normalize_name("Professor Alice Lee") == "alice lee"
        assert _normalize_name("") == ""

    def test_normalize_org(self):
        assert _normalize_org("University of Texas") != ""
        assert _normalize_org("The Ohio State University") != ""
        assert _normalize_org("") == ""

    def test_merge_lists(self):
        a = ["SLAM", "Path Planning"]
        b = ["SLAM", "Computer Vision"]
        result = _merge_lists(a, b)
        assert "SLAM" in result
        assert "Path Planning" in result
        assert "Computer Vision" in result
        assert len(result) == 3

    def test_merge_lists_empty(self):
        assert _merge_lists(None, None) == []
        assert _merge_lists([], []) == []

    def test_pick_best(self):
        assert _pick_best("alice@mit.edu", None) == "alice@mit.edu"
        assert _pick_best(None, "bob@stanford.edu") == "bob@stanford.edu"
        assert _pick_best("", "bob@stanford.edu") == "bob@stanford.edu"
        assert _pick_best(0, 42) == 42
        assert _pick_best(10, 42) == 10

    def test_richness_score_empty(self):
        p = DroneProspect(
            id=uuid.uuid4(),
            name="Dr. Empty",
            organization="Unknown",
            status="discovered",
        )
        assert _richness_score(p) == 0

    def test_richness_score_rich(self):
        p = DroneProspect(
            id=uuid.uuid4(),
            name="Dr. Rich",
            email="rich@mit.edu",
            organization="MIT",
            h_index=30,
            total_grant_funding=500000,
            research_areas=["SLAM", "FPGA", "Control"],
            recent_papers=[{"title": "Test"}],
            active_grants=[{"title": "NSF Grant"}],
            scholar_url="https://scholar.google.com/...",
            lab_name="Autonomous Systems Lab",
            department="Aerospace",
            status="discovered",
        )
        assert _richness_score(p) > 30


class TestDedupMerge:

    async def test_merge_pair_fills_gaps(self, db_session):
        keep = DroneProspect(
            id=uuid.uuid4(),
            name="Dr. Sarah Chen",
            email="sarah@mit.edu",
            organization="MIT",
            h_index=25,
            status="discovered",
            source="google_scholar",
        )
        drop = DroneProspect(
            id=uuid.uuid4(),
            name="Sarah Chen",
            organization="MIT",
            department="Aerospace Engineering",
            total_grant_funding=300000,
            active_grants=[{"agency": "NSF", "amount": 300000}],
            research_areas=["SLAM"],
            status="discovered",
            source="nsf",
        )
        db_session.add(keep)
        db_session.add(drop)
        await db_session.flush()

        await _merge_pair(keep, drop, db_session)

        # keep should now have the merged data
        assert keep.department == "Aerospace Engineering"
        assert keep.total_grant_funding == 300000
        assert "SLAM" in keep.research_areas
        assert keep.email == "sarah@mit.edu"  # kept from original
        assert keep.h_index == 25  # kept from original
        assert drop.status == "merged"

    async def test_merge_pair_boolean_true_wins(self, db_session):
        keep = DroneProspect(
            id=uuid.uuid4(),
            name="Dr. Test",
            organization="Test Uni",
            has_drone_lab=False,
            status="discovered",
        )
        drop = DroneProspect(
            id=uuid.uuid4(),
            name="Dr. Test",
            organization="Test Uni",
            has_drone_lab=True,
            has_fpga=True,
            status="discovered",
        )
        db_session.add(keep)
        db_session.add(drop)
        await db_session.flush()

        await _merge_pair(keep, drop, db_session)

        assert keep.has_drone_lab is True
        assert keep.has_fpga is True
