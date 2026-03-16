"""
AJ Builds Drone — Phase 6 Tests: Scale.

Tests for:
- GitHub contributor scraper (unit + mocked API)
- SAM.gov solicitation monitor (unit + mocked API)
- A/B test framework (variant assignment, experiment results)
- Scoring weight optimizer (feature analysis)
- New discovery routes (github, sam-gov, seed-batch)
- Agent registration (13 agents total)
"""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
import pytest_asyncio

from api.models.prospect import DroneProspect, OutreachEmail


# ═══════════════════════════════════════════════════════════════════════
# GitHub Crawler
# ═══════════════════════════════════════════════════════════════════════

class TestGitHubCrawler:

    def test_target_repos_exist(self):
        from api.services.github_crawler import TARGET_REPOS
        assert len(TARGET_REPOS) >= 10
        assert "PX4/PX4-Autopilot" in TARGET_REPOS
        assert "ArduPilot/ardupilot" in TARGET_REPOS

    def test_bio_drone_related(self):
        from api.services.github_crawler import _bio_is_drone_related
        assert _bio_is_drone_related("Robotics researcher working on drone SLAM and autonomous navigation")
        assert not _bio_is_drone_related("Web developer building React apps")
        assert not _bio_is_drone_related("")
        assert not _bio_is_drone_related(None)

    def test_bio_needs_two_keywords(self):
        from api.services.github_crawler import _bio_is_drone_related
        # Single keyword should not match
        assert not _bio_is_drone_related("I work on drones")
        # Two or more should match
        assert _bio_is_drone_related("I work on drones and robotics")

    def test_extract_email_from_bio(self):
        from api.services.github_crawler import _extract_email_from_bio
        assert _extract_email_from_bio("Contact me at prof@mit.edu") == "prof@mit.edu"
        assert _extract_email_from_bio("No email here") is None
        assert _extract_email_from_bio(None) is None

    def test_infer_org_type(self):
        from api.services.github_crawler import _infer_org_type
        assert _infer_org_type("MIT") == "university"
        assert _infer_org_type("Stanford University") == "university"
        assert _infer_org_type("NASA") == "government"
        assert _infer_org_type("U.S. Army Research") == "government"
        assert _infer_org_type("Lockheed Martin") == "defense_contractor"
        assert _infer_org_type("DroneStartup Inc") == "startup"
        assert _infer_org_type("") == "unknown"
        assert _infer_org_type(None) == "unknown"

    def test_infer_stack(self):
        from api.services.github_crawler import _infer_stack
        stack = _infer_stack("PX4/PX4-Autopilot")
        assert "PX4" in stack
        assert "C++" in stack
        stack2 = _infer_stack("ArduPilot/ardupilot")
        assert "ArduPilot" in stack2

    def test_headers_with_token(self):
        from api.services.github_crawler import _headers
        with patch("api.services.github_crawler.settings") as mock_settings:
            mock_settings.gh_token = "test_token_123"
            h = _headers()
            assert "Authorization" in h
            assert "test_token_123" in h["Authorization"]

    def test_headers_without_token(self):
        from api.services.github_crawler import _headers
        with patch("api.services.github_crawler.settings") as mock_settings:
            mock_settings.gh_token = ""
            h = _headers()
            assert "Authorization" not in h


# ═══════════════════════════════════════════════════════════════════════
# SAM.gov Crawler
# ═══════════════════════════════════════════════════════════════════════

class TestSAMCrawler:

    def test_sam_queries_exist(self):
        from api.services.sam_crawler import SAM_QUERIES
        assert len(SAM_QUERIES) >= 5
        assert any("drone" in q.lower() or "uas" in q.lower() for q in SAM_QUERIES)

    def test_drone_naics_codes(self):
        from api.services.sam_crawler import DRONE_NAICS
        assert "541330" in DRONE_NAICS  # Engineering Services
        assert "336411" in DRONE_NAICS  # Aircraft Manufacturing

    def test_extract_agency_name(self):
        from api.services.sam_crawler import _extract_agency_name
        assert _extract_agency_name("Department of Defense.Army") == "Department of Defense"
        assert _extract_agency_name("NASA") == "NASA"
        assert _extract_agency_name("") == "U.S. Government"
        assert _extract_agency_name(None) == "U.S. Government"

    def test_extract_topics(self):
        from api.services.sam_crawler import _extract_topics
        topics = _extract_topics("UAV Inspection Services for Bridge Infrastructure", "Seeking autonomous drone inspection capability with LiDAR")
        assert "UAV operations" in topics or "drone services" in topics
        assert "inspection services" in topics

    def test_thirty_days_ago_format(self):
        from api.services.sam_crawler import _thirty_days_ago
        result = _thirty_days_ago()
        # Should be MM/dd/yyyy
        assert len(result.split("/")) == 3
        month, day, year = result.split("/")
        assert len(month) == 2
        assert len(year) == 4

    def test_extract_contact_email(self):
        from api.services.sam_crawler import _extract_contact_email
        data = {"pointOfContact": [{"email": "contracting@army.mil", "fullName": "John Doe"}]}
        assert _extract_contact_email(data) == "contracting@army.mil"
        assert _extract_contact_email({}) is None
        assert _extract_contact_email({"pointOfContact": []}) is None


# ═══════════════════════════════════════════════════════════════════════
# A/B Testing Framework
# ═══════════════════════════════════════════════════════════════════════

class TestABTesting:

    def test_variant_assignment_deterministic(self):
        from api.services.ab_testing import assign_variant
        pid = str(uuid.uuid4())
        v1 = assign_variant(pid, "test_exp", ["control", "variant_a"])
        v2 = assign_variant(pid, "test_exp", ["control", "variant_a"])
        assert v1 == v2  # Same prospect always gets same variant

    def test_variant_assignment_different_prospects(self):
        from api.services.ab_testing import assign_variant
        # With enough prospects, both variants should appear
        variants_seen = set()
        for _ in range(50):
            pid = str(uuid.uuid4())
            v = assign_variant(pid, "test_exp", ["control", "variant_a"])
            variants_seen.add(v)
        assert len(variants_seen) == 2  # Both variants assigned

    def test_variant_empty_list(self):
        from api.services.ab_testing import assign_variant
        assert assign_variant("pid", "exp", []) == "control"

    def test_active_experiments_exist(self):
        from api.services.ab_testing import ACTIVE_EXPERIMENTS
        assert len(ACTIVE_EXPERIMENTS) >= 1
        # Each experiment should have step, field, variants
        for name, exp in ACTIVE_EXPERIMENTS.items():
            assert "step" in exp
            assert "field" in exp
            assert "variants" in exp
            assert len(exp["variants"]) >= 2

    def test_get_experiment_for_step(self):
        from api.services.ab_testing import get_experiment_for_step
        step1_exps = get_experiment_for_step(1)
        assert len(step1_exps) >= 1
        # Step 99 should have none
        assert get_experiment_for_step(99) == []

    def test_apply_variant_returns_tuple(self):
        from api.services.ab_testing import apply_variant
        subject, template_id, personalization = apply_variant(
            str(uuid.uuid4()), 1,
            "Test Subject", "lab_capability_audit",
            {"last_name": "Smith", "organization": "MIT"},
        )
        assert isinstance(subject, str)
        assert isinstance(template_id, str)
        assert "_ab_variants" in personalization

    def test_apply_variant_stores_assignment(self):
        from api.services.ab_testing import apply_variant
        pid = str(uuid.uuid4())
        _, _, personalization = apply_variant(
            pid, 1, "Subject", "template",
            {"last_name": "Test", "organization": "CMU"},
        )
        ab = personalization["_ab_variants"]
        assert isinstance(ab, dict)
        assert len(ab) >= 1  # At least one experiment assigned

    @pytest.mark.asyncio
    async def test_experiment_results_empty(self):
        """No sent emails → empty results."""
        with patch("api.services.ab_testing.async_session_factory") as mock_sf:
            mock_session = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = []
            mock_session.execute.return_value = mock_result
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)

            from api.services.ab_testing import get_experiment_results
            results = await get_experiment_results()
            assert results == {}

    @pytest.mark.asyncio
    async def test_winning_variant_insufficient_data(self):
        """No data → no winner."""
        with patch("api.services.ab_testing.get_experiment_results", new_callable=AsyncMock, return_value={}):
            from api.services.ab_testing import get_winning_variant
            winner = await get_winning_variant("nonexistent")
            assert winner is None


# ═══════════════════════════════════════════════════════════════════════
# Scoring Weight Optimizer
# ═══════════════════════════════════════════════════════════════════════

class TestWeightOptimizer:

    def test_extract_features(self):
        from api.services.weight_optimizer import _extract_features
        from types import SimpleNamespace
        p = SimpleNamespace(
            has_custom_hardware=True, has_fpga=False, has_drone_lab=True,
            simulation_setup="Gazebo", h_index=35, total_grant_funding=250000,
            active_grants=[{"title": "NSF"}], organization_type="university",
            lab_students_count=12, sensor_types=["camera"],
            publication_rate=5.0, source="scholar", tier="hot",
        )
        features = _extract_features(p)
        assert features["has_custom_hardware"] is True
        assert features["has_fpga"] is False
        assert features["has_drone_lab"] is True
        assert features["has_simulation"] is True
        assert features["h_index_high"] is True
        assert features["grant_large"] is True
        assert features["org_university"] is True
        assert features["lab_large"] is True
        assert features["source_scholar"] is True
        assert features["tier_hot"] is True

    def test_extract_features_empty_prospect(self):
        from api.services.weight_optimizer import _extract_features
        from types import SimpleNamespace
        p = SimpleNamespace(
            has_custom_hardware=None, has_fpga=None, has_drone_lab=None,
            simulation_setup=None, h_index=None, total_grant_funding=None,
            active_grants=None, organization_type=None,
            lab_students_count=None, sensor_types=None,
            publication_rate=None, source=None, tier=None,
        )
        features = _extract_features(p)
        assert features["has_custom_hardware"] is False
        assert features["grant_large"] is False
        assert features["org_university"] is False

    def test_generate_suggestions(self):
        from api.services.weight_optimizer import _generate_suggestions
        analysis = {
            "has_fpga": {"recommendation": "increase_weight", "present_reply_rate": 20.0, "absent_reply_rate": 5.0, "lift": 300.0},
            "org_university": {"recommendation": "keep", "present_reply_rate": 10.0, "absent_reply_rate": 9.0, "lift": 11.0},
            "lab_small": {"recommendation": "decrease_weight", "present_reply_rate": 2.0, "absent_reply_rate": 12.0, "lift": -83.3},
        }
        suggestions = _generate_suggestions(analysis)
        assert len(suggestions) == 2  # Only increase/decrease, not "keep"
        assert any("has_fpga" in s for s in suggestions)
        assert any("lab_small" in s for s in suggestions)

    @pytest.mark.asyncio
    async def test_analyze_engagement_insufficient_data(self):
        with patch("api.services.weight_optimizer.async_session_factory") as mock_sf:
            mock_session = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = []
            mock_session.execute.return_value = mock_result
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)

            from api.services.weight_optimizer import analyze_engagement
            result = await analyze_engagement()
            assert "error" in result


# ═══════════════════════════════════════════════════════════════════════
# Discovery Routes (API)
# ═══════════════════════════════════════════════════════════════════════

class TestDiscoveryRoutes:

    @pytest.mark.asyncio
    async def test_github_discover_route(self, client):
        with patch("api.services.github_crawler.crawl_github_contributors", new_callable=AsyncMock,
                   return_value={"batch_id": "test", "prospects_found": 5, "prospects_new": 3, "repos_scanned": 2}):
            resp = await client.post("/outreach/discover/github")
            assert resp.status_code == 200
            data = resp.json()
            assert data["prospects_found"] == 5

    @pytest.mark.asyncio
    async def test_sam_gov_discover_route(self, client):
        with patch("api.services.sam_crawler.crawl_sam_gov", new_callable=AsyncMock,
                   return_value={"batch_id": "test", "prospects_found": 10, "prospects_new": 7, "solicitations_scanned": 25}):
            resp = await client.post("/outreach/discover/sam-gov")
            assert resp.status_code == 200
            data = resp.json()
            assert data["prospects_found"] == 10

    @pytest.mark.asyncio
    async def test_seed_batch_route(self, client):
        mock_result = {"batch_id": "x", "prospects_found": 5, "prospects_new": 3}
        with patch("api.services.scholar_crawler.crawl_scholar", new_callable=AsyncMock, return_value=mock_result), \
             patch("api.services.nsf_crawler.crawl_nsf", new_callable=AsyncMock, return_value=mock_result), \
             patch("api.services.faculty_crawler.crawl_faculty_pages", new_callable=AsyncMock, return_value=mock_result), \
             patch("api.services.arxiv_crawler.discover_arxiv_prospects", new_callable=AsyncMock, return_value=mock_result), \
             patch("api.services.github_crawler.crawl_github_contributors", new_callable=AsyncMock, return_value=mock_result), \
             patch("api.services.sam_crawler.crawl_sam_gov", new_callable=AsyncMock, return_value=mock_result):
            resp = await client.post("/outreach/discover/seed-batch", json={})
            assert resp.status_code == 200
            data = resp.json()
            assert data["sources_run"] == 6
            assert data["total_new"] == 18  # 6 sources × 3 each

    @pytest.mark.asyncio
    async def test_seed_batch_selective_sources(self, client):
        mock_result = {"batch_id": "x", "prospects_found": 5, "prospects_new": 3}
        with patch("api.services.scholar_crawler.crawl_scholar", new_callable=AsyncMock, return_value=mock_result), \
             patch("api.services.github_crawler.crawl_github_contributors", new_callable=AsyncMock, return_value=mock_result):
            resp = await client.post("/outreach/discover/seed-batch", json={"sources": ["scholar", "github"]})
            assert resp.status_code == 200
            data = resp.json()
            assert data["sources_run"] == 2


# ═══════════════════════════════════════════════════════════════════════
# A/B Test & Optimizer Routes (API)
# ═══════════════════════════════════════════════════════════════════════

class TestABTestRoutes:

    @pytest.mark.asyncio
    async def test_list_experiments(self, client):
        resp = await client.get("/outreach/ab-tests/experiments")
        assert resp.status_code == 200
        data = resp.json()
        assert "step1_subject" in data
        assert "variants" in data["step1_subject"]

    @pytest.mark.asyncio
    async def test_get_ab_results(self, client):
        with patch("api.services.ab_testing.get_experiment_results", new_callable=AsyncMock, return_value={}):
            resp = await client.get("/outreach/ab-tests")
            assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_get_ab_winner(self, client):
        with patch("api.services.ab_testing.get_winning_variant", new_callable=AsyncMock, return_value="variant_a"):
            resp = await client.get("/outreach/ab-tests/winner/step1_subject")
            assert resp.status_code == 200
            data = resp.json()
            assert data["winner"] == "variant_a"

    @pytest.mark.asyncio
    async def test_optimizer_engagement_route(self, client):
        with patch("api.services.weight_optimizer.analyze_engagement", new_callable=AsyncMock,
                   return_value={"error": "Insufficient data", "total": 0}):
            resp = await client.get("/outreach/optimizer/engagement")
            assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_optimizer_sources_route(self, client):
        with patch("api.services.weight_optimizer.analyze_source_performance", new_callable=AsyncMock,
                   return_value={"scholar": {"total_discovered": 100}}):
            resp = await client.get("/outreach/optimizer/sources")
            assert resp.status_code == 200
            data = resp.json()
            assert "scholar" in data


# ═══════════════════════════════════════════════════════════════════════
# Scheduler Registration
# ═══════════════════════════════════════════════════════════════════════

class TestSchedulerRegistration:

    def test_all_agents_registered(self):
        from api.agents.scheduler import register_all_agents, scheduler
        register_all_agents()
        assert len(scheduler.agents) >= 14

    def test_github_agent_registered(self):
        from api.agents.scheduler import register_all_agents, scheduler
        register_all_agents()
        assert "github_crawler" in scheduler.agents
        assert "sam_gov_crawler" in scheduler.agents
        assert scheduler.agents["github_crawler"].interval == 24 * 3600
        assert scheduler.agents["sam_gov_crawler"].interval == 12 * 3600


# ═══════════════════════════════════════════════════════════════════════
# Root Endpoint Version
# ═══════════════════════════════════════════════════════════════════════

class TestRootVersion:

    @pytest.mark.asyncio
    async def test_root_version_4(self, client):
        resp = await client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["version"] == "4.0.0"
        assert "discover_github" in data["endpoints"]
        assert "discover_sam_gov" in data["endpoints"]
        assert "ab_tests" in data["endpoints"]
        assert "optimizer" in data["endpoints"]
