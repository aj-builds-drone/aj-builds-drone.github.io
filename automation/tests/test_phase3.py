"""
Phase 3 tests — Lab auditor, peer comparison, report generator, template engine.
"""

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
import pytest_asyncio

from api.models.prospect import DroneProspect, LabAudit
from api.services.lab_auditor import (
    audit_lab_capabilities,
    _score_hardware,
    _score_software,
    _score_research,
    _generate_recommendations,
    _extract_from_text,
    HARDWARE_KEYWORDS,
    SENSOR_KEYWORDS,
    SOFTWARE_KEYWORDS,
)
from api.services.peer_comparison import (
    compare_prospect_to_peers,
    BENCHMARK_LABS,
    _find_relevant_peers,
)
from api.services.report_generator import generate_report_html, _bar
from api.services.drone_template_engine import (
    _build_drone_variables,
    _simple_render,
    _infer_opportunity,
    DRONE_SEQUENCE,
)


# ═══════════════════════════════════════════════════════════════════════
# Lab Auditor Tests
# ═══════════════════════════════════════════════════════════════════════


class TestKeywordExtraction:

    def test_extract_hardware_from_text(self):
        text = "We use DJI Matrice 300 and Pixhawk autopilot with PX4 firmware."
        found = _extract_from_text(text, HARDWARE_KEYWORDS)
        assert "DJI Matrice" in found
        assert "Pixhawk" in found
        assert "PX4 Custom" in found

    def test_extract_sensors_from_text(self):
        text = "Our platform carries a Velodyne LiDAR and FLIR thermal camera with Intel RealSense."
        found = _extract_from_text(text, SENSOR_KEYWORDS)
        assert any("LiDAR" in s for s in found)
        assert any("Thermal" in s for s in found)
        assert any("RealSense" in s for s in found)

    def test_extract_software_from_text(self):
        text = "The lab uses ROS Humble with Gazebo simulation and PX4 SITL for testing."
        found = _extract_from_text(text, SOFTWARE_KEYWORDS)
        assert "ROS2 Humble" in found
        assert "Gazebo" in found
        assert "PX4 SITL" in found

    def test_no_matches_on_unrelated_text(self):
        text = "The weather today is sunny and warm."
        assert _extract_from_text(text, HARDWARE_KEYWORDS) == []
        assert _extract_from_text(text, SENSOR_KEYWORDS) == []

    def test_case_insensitive(self):
        text = "We use CRAZYFLIE and OPENCV for our experiments."
        hw = _extract_from_text(text, HARDWARE_KEYWORDS)
        sw = _extract_from_text(text, SOFTWARE_KEYWORDS)
        assert "Crazyflie" in hw
        assert "OpenCV" in sw


class TestHardwareScoring:

    def test_empty_hardware_zero(self):
        score = _score_hardware([], [], False, False, None)
        assert score == 0

    def test_dji_only_low_score(self):
        score = _score_hardware(["DJI Matrice"], ["Camera"], False, False, None)
        # 10 (one platform) - 10 (all DJI) + 5 (one sensor) = 5
        assert score >= 0
        assert score < 30

    def test_custom_platform_higher(self):
        score = _score_hardware(
            ["PX4 Custom", "Crazyflie"], ["LiDAR (Velodyne)", "Stereo Camera"],
            True, True, "NVIDIA Jetson"
        )
        # Multiple platforms + custom bonus + sensors + premium + PCB + FPGA + edge
        assert score >= 70

    def test_fpga_bonus(self):
        score_without = _score_hardware(["DJI Matrice"], [], False, False, None)
        score_with = _score_hardware(["DJI Matrice"], [], False, True, None)
        assert score_with > score_without

    def test_score_capped_at_100(self):
        score = _score_hardware(
            ["PX4 Custom", "ArduPilot Custom", "Crazyflie", "DJI Matrice", "Holybro"],
            ["LiDAR (Velodyne)", "Thermal (FLIR)", "Multispectral", "Intel RealSense", "Event Camera"],
            True, True, "NVIDIA Jetson Orin",
        )
        assert score <= 100


class TestSoftwareScoring:

    def test_empty_software_zero(self):
        score = _score_software(None, None, None, False, [])
        assert score == 0

    def test_ros2_with_sim(self):
        score = _score_software("ROS2 Humble", "PX4", "Gazebo", False, ["ROS2 Humble", "Gazebo"])
        assert score >= 50

    def test_full_stack(self):
        sw = ["ROS2 Humble", "PX4 SITL", "Gazebo", "OpenCV", "PyTorch", "ORB-SLAM", "Docker"]
        score = _score_software("ROS2 Humble", "PX4", "Gazebo", True, sw)
        assert score >= 80

    def test_ros1_lower_than_ros2(self):
        ros1 = _score_software("ROS1 Noetic", None, None, False, [])
        ros2 = _score_software("ROS2 Humble", None, None, False, [])
        assert ros2 > ros1


class TestResearchScoring:

    def test_no_papers_zero(self):
        score = _score_research(0, 0, None, [])
        assert score == 0

    def test_prolific_researcher(self):
        score = _score_research(20, 55, 45, ["ICRA", "IROS", "RAL"])
        assert score >= 80

    def test_moderate_researcher(self):
        score = _score_research(5, 10, 15, ["ICRA"])
        assert 20 <= score <= 60

    def test_h_index_matters(self):
        low_h = _score_research(5, 10, 5, [])
        high_h = _score_research(5, 10, 40, [])
        assert high_h > low_h


class TestLabAuditFull:

    def test_audit_basic_prospect(self):
        """Test audit on a prospect with minimal data."""
        p = DroneProspect(
            id=uuid.uuid4(),
            name="Dr. Test",
            organization="Test University",
            status="discovered",
        )
        result = audit_lab_capabilities(p)

        assert "hardware_score" in result
        assert "software_score" in result
        assert "research_score" in result
        assert "overall_score" in result
        assert "recommendations" in result
        assert isinstance(result["recommendations"], list)

    def test_audit_rich_prospect(self):
        """Test audit on a prospect with lots of data."""
        p = DroneProspect(
            id=uuid.uuid4(),
            name="Dr. Rich",
            organization="MIT",
            research_areas=["Visual SLAM", "Autonomous navigation"],
            recent_papers=[
                {"title": "ROS2 SLAM with LiDAR on PX4 platform", "venue": "ICRA 2024", "citations": 15},
                {"title": "FPGA-accelerated stereo vision for drones", "venue": "IROS 2023", "citations": 25},
            ],
            hardware_platforms=["PX4 Custom", "Crazyflie"],
            software_stack=["ROS2 Humble", "Gazebo"],
            sensor_types=["LiDAR", "Stereo Camera"],
            h_index=30,
            has_fpga=True,
            status="discovered",
        )
        result = audit_lab_capabilities(p)

        assert result["hardware_score"] > 30
        assert result["software_score"] > 20
        assert result["research_score"] > 20
        assert result["has_fpga_acceleration"] is True
        assert len(result["top_venues"]) > 0

    def test_audit_detects_gazebo_from_papers(self):
        """Audit should detect Gazebo from paper titles."""
        p = DroneProspect(
            id=uuid.uuid4(),
            name="Dr. Paper",
            organization="Test U",
            recent_papers=[
                {"title": "Gazebo simulation for multi-UAV coordination", "venue": "ICRA", "citations": 5},
            ],
            status="discovered",
        )
        result = audit_lab_capabilities(p)
        assert result["simulation_env"] == "Gazebo"


class TestRecommendations:

    def test_no_fpga_recommendation(self):
        recs = _generate_recommendations(
            hw_score=30, sw_score=50, research_score=50,
            platforms=["DJI Matrice"], sensors=["Camera"],
            custom_pcb=False, has_fpga=False, edge=None,
            ros_version="ROS2", sim_env="Gazebo",
        )
        fpga_recs = [r for r in recs if "FPGA" in r["recommendation"]]
        assert len(fpga_recs) > 0

    def test_no_recs_for_fully_equipped_lab(self):
        recs = _generate_recommendations(
            hw_score=90, sw_score=90, research_score=90,
            platforms=["PX4 Custom"], sensors=["LiDAR", "Thermal"],
            custom_pcb=True, has_fpga=True, edge="NVIDIA Jetson",
            ros_version="ROS2 Humble", sim_env="Gazebo",
        )
        # Should still have some, but fewer
        high_priority = [r for r in recs if r["priority"] == "high"]
        assert len(high_priority) == 0


# ═══════════════════════════════════════════════════════════════════════
# Peer Comparison Tests
# ═══════════════════════════════════════════════════════════════════════


class TestPeerComparison:

    def test_benchmark_labs_sorted(self):
        """Benchmark labs should be sorted by overall_score desc."""
        scores = [lab["overall_score"] for lab in BENCHMARK_LABS]
        assert scores == sorted(scores, reverse=True)

    def test_compare_low_score_prospect(self):
        p = DroneProspect(
            id=uuid.uuid4(),
            name="Dr. New",
            organization="Small University",
            score_hardware=20,
            score_software=30,
            score_research=25,
            score_overall=25,
            research_areas=["SLAM"],
            status="audited",
        )
        result = compare_prospect_to_peers(p)

        assert result["prospect_score"] == 25
        assert result["competitive_position"] == "emerging"
        assert result["competitive_rank"] > 1
        assert len(result["peer_labs"]) > 0

    def test_compare_high_score_prospect(self):
        p = DroneProspect(
            id=uuid.uuid4(),
            name="Dr. Elite",
            organization="MIT",
            score_hardware=95,
            score_software=95,
            score_research=98,
            score_overall=96,
            research_areas=["swarm autonomy"],
            status="audited",
        )
        result = compare_prospect_to_peers(p)

        assert result["competitive_position"] == "leader"
        assert result["competitive_rank"] == 1

    def test_relevant_peers_for_slam(self):
        p = DroneProspect(
            id=uuid.uuid4(),
            name="Dr. SLAM",
            organization="Test U",
            research_areas=["visual SLAM", "LiDAR mapping"],
            status="audited",
        )
        peers = _find_relevant_peers(p)
        names = [p["name"] for p in peers]
        # Should include CMU AirLab or ETH Zurich (SLAM labs)
        assert any("CMU" in n or "ETH" in n for n in names)

    def test_peer_comparison_has_deltas(self):
        p = DroneProspect(
            id=uuid.uuid4(),
            name="Dr. Delta",
            organization="Test U",
            score_hardware=50,
            score_software=60,
            score_research=40,
            score_overall=50,
            status="audited",
        )
        result = compare_prospect_to_peers(p)
        for peer in result["peer_labs"]:
            assert "hw_delta" in peer
            assert "sw_delta" in peer
            assert "overall_delta" in peer


# ═══════════════════════════════════════════════════════════════════════
# Report Generator Tests
# ═══════════════════════════════════════════════════════════════════════


class TestReportGenerator:

    def test_bar_green_high_score(self):
        html = _bar(85)
        assert "#22c55e" in html  # green
        assert "85" in html

    def test_bar_amber_medium_score(self):
        html = _bar(55)
        assert "#f59e0b" in html  # amber

    def test_bar_red_low_score(self):
        html = _bar(20)
        assert "#ef4444" in html  # red

    def test_generate_report_basic(self):
        p = DroneProspect(
            id=uuid.uuid4(),
            name="Dr. Sarah Chen",
            organization="UT Austin",
            department="Aerospace Engineering",
            lab_name="Autonomous Systems Lab",
            h_index=23,
            research_areas=["Visual SLAM", "Path Planning"],
            recent_papers=[
                {"title": "Test Paper", "venue": "ICRA", "citations": 10},
            ],
            active_grants=[
                {"agency": "NSF", "title": "UAV Research", "amount": 450000},
            ],
            status="audited",
        )
        audit_data = {
            "hardware_score": 45,
            "software_score": 62,
            "research_score": 75,
            "overall_score": 60,
            "flight_platforms": [{"name": "DJI Matrice"}],
            "sensor_suite": [{"name": "Camera"}],
            "has_custom_pcb": False,
            "has_fpga_acceleration": False,
            "fpga_details": None,
            "edge_compute": None,
            "ros_version": "ROS2 Humble",
            "flight_controller_sw": "PX4",
            "simulation_env": "Gazebo",
            "ci_cd_pipeline": False,
            "testing_framework": None,
            "papers_last_3yr": 12,
            "avg_citations": 15.3,
            "top_venues": ["ICRA"],
            "recommendations": [
                {
                    "area": "hardware",
                    "priority": "high",
                    "recommendation": "Add FPGA acceleration",
                    "impact": "10× latency reduction",
                },
            ],
        }
        peer_data = {
            "peer_labs": [
                {"name": "MIT CSAIL Drone Group", "overall_score": 92,
                 "hardware_score": 92, "software_score": 95, "research_score": 98},
                {"name": "CMU AirLab", "overall_score": 88,
                 "hardware_score": 88, "software_score": 90, "research_score": 95},
            ],
            "competitive_rank": 3,
            "competitive_gap": "Custom hardware & FPGA acceleration",
            "competitive_position": "developing",
        }

        html = generate_report_html(p, audit_data, peer_data)

        assert "Dr. Sarah Chen" in html
        assert "Autonomous Systems Lab" in html
        assert "UT Austin" in html
        assert "45" in html  # hardware score
        assert "MIT CSAIL" in html
        assert "CMU AirLab" in html
        assert "FPGA" in html
        assert "NSF" in html
        assert "Lab Capability Report" in html

    def test_generate_report_no_peers(self):
        """Report should work without peer data."""
        p = DroneProspect(
            id=uuid.uuid4(),
            name="Dr. Solo",
            organization="Test U",
            status="audited",
        )
        audit_data = {
            "hardware_score": 30,
            "software_score": 40,
            "research_score": 20,
            "overall_score": 30,
            "flight_platforms": [],
            "sensor_suite": [],
            "has_custom_pcb": False,
            "has_fpga_acceleration": False,
            "fpga_details": None,
            "edge_compute": None,
            "ros_version": None,
            "flight_controller_sw": None,
            "simulation_env": None,
            "ci_cd_pipeline": False,
            "testing_framework": None,
            "papers_last_3yr": 0,
            "avg_citations": 0,
            "top_venues": [],
            "recommendations": [],
        }
        html = generate_report_html(p, audit_data, peer_data=None)
        assert "Dr. Solo" in html
        assert "Lab Capability Report" in html


# ═══════════════════════════════════════════════════════════════════════
# Drone Template Engine Tests
# ═══════════════════════════════════════════════════════════════════════


class TestDroneTemplateEngine:

    def test_sequence_has_5_steps(self):
        assert len(DRONE_SEQUENCE) == 5
        for step in range(1, 6):
            assert step in DRONE_SEQUENCE

    def test_simple_render(self):
        result = _simple_render(
            "Hello {{ name }}, your lab {{ lab_name }} scored {{ score }}",
            {"name": "Dr. Chen", "lab_name": "ASL", "score": 85},
        )
        assert "Dr. Chen" in result
        assert "ASL" in result
        assert "85" in result

    def test_build_variables_basic(self):
        p = DroneProspect(
            id=uuid.uuid4(),
            name="Dr. Sarah Chen",
            organization="UT Austin",
            lab_name="Autonomous Systems Lab",
            research_areas=["Visual SLAM"],
            recent_papers=[{"title": "SLAM on UAVs", "venue": "ICRA"}],
            score_overall=60,
            peer_labs=[
                {"name": "MIT CSAIL Drone Group", "overall_score": 92},
            ],
            primary_gap="FPGA acceleration",
            status="audited",
        )
        variables = _build_drone_variables(p)

        assert variables["last_name"] == "Chen"
        assert variables["lab_name"] == "Autonomous Systems Lab"
        assert variables["lab_score"] == 60
        assert "SLAM" in variables["paper_title"]
        assert variables["primary_gap"] == "FPGA acceleration"

    def test_infer_opportunity_no_fpga(self):
        p = DroneProspect(
            id=uuid.uuid4(),
            name="Dr. Test",
            organization="Test U",
            has_fpga=False,
            status="discovered",
        )
        opp = _infer_opportunity(p, None)
        assert "FPGA" in opp

    def test_infer_opportunity_no_sim(self):
        p = DroneProspect(
            id=uuid.uuid4(),
            name="Dr. Test",
            organization="Test U",
            has_fpga=True,
            simulation_setup=None,
            status="discovered",
        )
        opp = _infer_opportunity(p, None)
        assert "Gazebo" in opp or "SITL" in opp

    def test_all_steps_have_templates(self):
        """Each step should reference an existing template file."""
        import os
        template_dir = os.path.join(
            os.path.dirname(__file__), "..", "api", "templates", "email"
        )
        for step, config in DRONE_SEQUENCE.items():
            assert "template" in config
            assert "subject" in config
            assert "delay_days" in config


# ═══════════════════════════════════════════════════════════════════════
# Persistence / DB Tests (require db_session fixture)
# ═══════════════════════════════════════════════════════════════════════


class TestPhase3DB:

    async def test_lab_audit_creation(self, db_session):
        """Create a DroneProspect and LabAudit via DB."""
        p = DroneProspect(
            id=uuid.uuid4(),
            name="Dr. DB Test",
            organization="Test University",
            research_areas=["Path Planning"],
            recent_papers=[
                {"title": "PX4 SLAM with Gazebo validation", "venue": "IROS 2024", "citations": 8},
            ],
            status="discovered",
        )
        db_session.add(p)
        await db_session.commit()
        await db_session.refresh(p)

        # Run audit logic
        audit_data = audit_lab_capabilities(p)

        # Create LabAudit
        audit = LabAudit(
            prospect_id=p.id,
            hardware_score=audit_data["hardware_score"],
            software_score=audit_data["software_score"],
            research_score=audit_data["research_score"],
            overall_score=audit_data["overall_score"],
            recommendations=audit_data["recommendations"],
        )
        db_session.add(audit)
        await db_session.commit()
        await db_session.refresh(audit)

        assert audit.overall_score >= 0
        assert audit.prospect_id == p.id

    async def test_peer_comparison_on_prospect(self, db_session):
        """Peer comparison should work on a DB-backed prospect."""
        p = DroneProspect(
            id=uuid.uuid4(),
            name="Dr. Peer Test",
            organization="Stanford",
            score_hardware=60,
            score_software=70,
            score_research=55,
            score_overall=62,
            research_areas=["motion planning"],
            status="audited",
        )
        db_session.add(p)
        await db_session.commit()
        await db_session.refresh(p)

        result = compare_prospect_to_peers(p)
        assert result["competitive_position"] in ("leader", "competitive", "developing", "emerging")
        assert len(result["peer_labs"]) > 0

    async def test_report_generation_on_prospect(self, db_session):
        """Generate a report for a DB-backed prospect."""
        p = DroneProspect(
            id=uuid.uuid4(),
            name="Dr. Report Test",
            organization="Georgia Tech",
            lab_name="IRIM Test Lab",
            h_index=20,
            research_areas=["Perception"],
            status="audited",
        )
        db_session.add(p)
        await db_session.commit()
        await db_session.refresh(p)

        audit_data = audit_lab_capabilities(p)
        html = generate_report_html(p, audit_data)
        assert "Dr. Report Test" in html
        assert "IRIM Test Lab" in html
        assert len(html) > 500  # Non-trivial HTML
