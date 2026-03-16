"""
Lab Capability Auditor — the drone equivalent of a website audit.

Analyzes a prospect's publications, faculty pages, and enrichment data to
detect their hardware/software stack, score research output, and produce a
Lab Capability Report.

Phase 3 of OUTREACH_STRATEGY.md (§3.2).
"""

import logging
import re
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from api.database import async_session_factory
from api.models.prospect import DroneProspect, LabAudit

logger = logging.getLogger("drone.lab_auditor")

# ═══════════════════════════════════════════════════════════════════════
# Knowledge bases — keyword → detection
# ═══════════════════════════════════════════════════════════════════════

HARDWARE_KEYWORDS = {
    # Flight platforms
    "dji matrice": "DJI Matrice",
    "dji phantom": "DJI Phantom",
    "dji mavic": "DJI Mavic",
    "dji inspire": "DJI Inspire",
    "crazyflie": "Crazyflie",
    "pixhawk": "Pixhawk",
    "px4": "PX4 Custom",
    "ardupilot": "ArduPilot Custom",
    "betaflight": "Betaflight Custom",
    "holybro": "Holybro",
    "tello": "DJI Tello",
    "parrot": "Parrot",
    "skydio": "Skydio",
    "autel": "Autel EVO",
    "intel aero": "Intel Aero RTF",
    "nxp hovergames": "NXP HoverGames",
    "3dr solo": "3DR Solo",
    "custom quadrotor": "Custom Quadrotor",
    "custom multirotor": "Custom Multirotor",
    "custom hexarotor": "Custom Hexarotor",
    "fixed-wing uav": "Fixed-Wing UAV",
    "fixed wing uav": "Fixed-Wing UAV",
    "vtol": "VTOL",
}

SENSOR_KEYWORDS = {
    "lidar": "LiDAR",
    "velodyne": "LiDAR (Velodyne)",
    "ouster": "LiDAR (Ouster)",
    "livox": "LiDAR (Livox)",
    "thermal camera": "Thermal Camera",
    "flir": "Thermal (FLIR)",
    "multispectral": "Multispectral",
    "hyperspectral": "Hyperspectral",
    "stereo camera": "Stereo Camera",
    "realsense": "Intel RealSense",
    "zed camera": "ZED Stereo",
    "zed 2": "ZED 2 Stereo",
    "oakd": "OAK-D",
    "oak-d": "OAK-D",
    "event camera": "Event Camera",
    "dvs": "Dynamic Vision Sensor",
    "imu": "IMU",
    "gps rtk": "RTK GPS",
    "rtk": "RTK GPS",
    "uwb": "UWB",
    "radar": "Radar",
    "sonar": "Sonar",
    "altimeter": "Altimeter",
    "optical flow": "Optical Flow",
    "depth camera": "Depth Camera",
    "rgb-d": "RGB-D Camera",
    "magnetometer": "Magnetometer",
    "barometer": "Barometer",
}

SOFTWARE_KEYWORDS = {
    "ros2": "ROS2",
    "ros 2": "ROS2",
    "ros humble": "ROS2 Humble",
    "ros galactic": "ROS2 Galactic",
    "ros foxy": "ROS2 Foxy",
    "ros iron": "ROS2 Iron",
    "ros jazzy": "ROS2 Jazzy",
    "ros1": "ROS1",
    "ros melodic": "ROS1 Melodic",
    "ros noetic": "ROS1 Noetic",
    "ros kinetic": "ROS1 Kinetic",
    "gazebo": "Gazebo",
    "airsim": "AirSim",
    "flightmare": "Flightmare",
    "webots": "Webots",
    "matlab": "MATLAB/Simulink",
    "simulink": "MATLAB/Simulink",
    "px4 sitl": "PX4 SITL",
    "px4 hitl": "PX4 HITL",
    "ardupilot sitl": "ArduPilot SITL",
    "qgroundcontrol": "QGroundControl",
    "mission planner": "Mission Planner",
    "mavros": "MAVROS",
    "mavlink": "MAVLink",
    "dronekit": "DroneKit",
    "opencv": "OpenCV",
    "tensorflow": "TensorFlow",
    "pytorch": "PyTorch",
    "tensorrt": "TensorRT",
    "isaac": "NVIDIA Isaac",
    "onnx": "ONNX",
    "vins-mono": "VINS-Mono",
    "orb-slam": "ORB-SLAM",
    "orbslam": "ORB-SLAM",
    "lsd-slam": "LSD-SLAM",
    "rtab-map": "RTAB-Map",
    "cartographer": "Google Cartographer",
    "docker": "Docker",
    "kubernetes": "Kubernetes",
    "jenkins": "Jenkins CI",
    "github actions": "GitHub Actions CI",
    "gitlab ci": "GitLab CI",
}

FPGA_KEYWORDS = {
    "fpga", "xilinx", "vivado", "verilog", "systemverilog",
    "vhdl", "artix", "zynq", "kintex", "ultrascale",
    "intel quartus", "altera", "lattice", "hls",
    "high-level synthesis", "high level synthesis",
}

EDGE_COMPUTE_KEYWORDS = {
    "jetson": "NVIDIA Jetson",
    "jetson nano": "NVIDIA Jetson Nano",
    "jetson xavier": "NVIDIA Jetson Xavier",
    "jetson orin": "NVIDIA Jetson Orin",
    "coral": "Google Coral TPU",
    "raspberry pi": "Raspberry Pi",
    "nuc": "Intel NUC",
    "stm32": "STM32",
    "esp32": "ESP32",
    "teensy": "Teensy",
    "nvidia": "NVIDIA GPU",
    "cuda": "CUDA GPU",
}

# How to detect custom PCB/firmware
CUSTOM_HW_KEYWORDS = {
    "custom pcb", "pcb design", "kicad", "altium", "eagle cad",
    "custom board", "flight controller design", "custom firmware",
    "embedded system design", "hardware-in-the-loop",
    "custom autopilot", "custom drone", "self-built",
}

# Top venues for drone/robotics research
TOP_VENUES = {
    "icra", "iros", "rss", "corl", "ral",
    "ieee transactions on robotics", "autonomous robots",
    "journal of field robotics", "aiaa", "auvsi",
    "cvpr", "iccv", "eccv", "neurips", "icml",
    "drone", "unmanned", "suas",
}


def _normalize_text(text: str) -> str:
    """Lowercase and collapse whitespace for keyword matching."""
    return re.sub(r"\s+", " ", text.lower().strip())


def _extract_from_text(text: str, keyword_map: dict[str, str]) -> list[str]:
    """Find all keyword matches in text, return deduplicated detected items."""
    norm = _normalize_text(text)
    found = []
    for keyword, label in keyword_map.items():
        if keyword in norm and label not in found:
            found.append(label)
    return found


def _detect_in_text(text: str, keywords: set[str]) -> bool:
    """Check if any keyword from a set appears in text."""
    norm = _normalize_text(text)
    return any(k in norm for k in keywords)


# ═══════════════════════════════════════════════════════════════════════
# Core Audit Logic — extracts lab capabilities from all available text
# ═══════════════════════════════════════════════════════════════════════

def audit_lab_capabilities(prospect: DroneProspect) -> dict:
    """
    Analyze a DroneProspect's publications, enrichment data, and profile
    to determine their lab capabilities.

    Returns a dict matching LabAudit fields.
    """
    # Gather all text we have about this prospect
    texts = []

    # Papers (title + abstract if available)
    for paper in (prospect.recent_papers or []):
        if isinstance(paper, dict):
            texts.append(paper.get("title", ""))
            texts.append(paper.get("abstract", ""))
            texts.append(paper.get("venue", ""))
        elif isinstance(paper, str):
            texts.append(paper)

    # Research areas
    for area in (prospect.research_areas or []):
        texts.append(area)

    # Lab description
    if prospect.lab_description:
        texts.append(prospect.lab_description)

    # Existing enrichment data
    enrichment = prospect.enrichment or {}
    if enrichment.get("faculty_page_text"):
        texts.append(enrichment["faculty_page_text"])
    if enrichment.get("lab_page_text"):
        texts.append(enrichment["lab_page_text"])
    if enrichment.get("bio"):
        texts.append(enrichment["bio"])

    # Already known hardware/software
    for hw in (prospect.hardware_platforms or []):
        texts.append(hw)
    for sw in (prospect.software_stack or []):
        texts.append(sw)
    for sensor in (prospect.sensor_types or []):
        texts.append(sensor)

    combined = " ".join(t for t in texts if t)

    # ── Hardware detection ──
    flight_platforms = _extract_from_text(combined, HARDWARE_KEYWORDS)
    sensor_suite = _extract_from_text(combined, SENSOR_KEYWORDS)
    has_custom_pcb = _detect_in_text(combined, CUSTOM_HW_KEYWORDS)
    has_custom_firmware = "custom firmware" in _normalize_text(combined) or has_custom_pcb
    has_fpga = _detect_in_text(combined, FPGA_KEYWORDS)

    fpga_details = None
    if has_fpga:
        fpga_parts = []
        norm = _normalize_text(combined)
        for kw in ("xilinx", "zynq", "artix", "kintex", "ultrascale", "vivado",
                    "altera", "lattice", "quartus", "vhdl", "verilog", "systemverilog", "hls"):
            if kw in norm:
                fpga_parts.append(kw.title())
        fpga_details = ", ".join(fpga_parts) if fpga_parts else "FPGA detected"

    # Edge compute
    edge_compute = None
    for kw, label in EDGE_COMPUTE_KEYWORDS.items():
        if kw in _normalize_text(combined):
            edge_compute = label
            break

    # ── Software detection ──
    detected_sw = _extract_from_text(combined, SOFTWARE_KEYWORDS)

    ros_version = None
    for sw in detected_sw:
        if "ROS2" in sw:
            ros_version = sw
            break
        elif "ROS1" in sw:
            ros_version = sw

    flight_controller_sw = None
    for sw in detected_sw:
        if sw in ("PX4 SITL", "PX4 HITL", "QGroundControl", "MAVROS", "MAVLink"):
            flight_controller_sw = "PX4"
            break
        elif sw in ("ArduPilot SITL", "Mission Planner", "DroneKit"):
            flight_controller_sw = "ArduPilot"
            break
    if not flight_controller_sw and prospect.flight_controller:
        flight_controller_sw = prospect.flight_controller

    sim_env = None
    for sw in detected_sw:
        if sw in ("Gazebo", "AirSim", "Flightmare", "Webots", "MATLAB/Simulink",
                   "PX4 SITL", "PX4 HITL", "ArduPilot SITL"):
            sim_env = sw
            break
    if not sim_env and prospect.simulation_setup:
        sim_env = prospect.simulation_setup

    ci_cd = any(sw in detected_sw for sw in ("Docker", "GitHub Actions CI",
                                              "GitLab CI", "Jenkins CI", "Kubernetes"))

    testing_framework = None
    norm = _normalize_text(combined)
    for fw in ("pytest", "gtest", "rostest", "ros2 test", "launch_testing", "unittest"):
        if fw in norm:
            testing_framework = fw
            break

    # ── Research output ──
    papers = prospect.recent_papers or []
    papers_last_3yr = len(papers)
    citations = [p.get("citations", 0) for p in papers if isinstance(p, dict)]
    avg_citations = sum(citations) / len(citations) if citations else 0

    # Top venues
    top_venues = []
    for paper in papers:
        if isinstance(paper, dict):
            venue = (paper.get("venue") or "").lower()
            for tv in TOP_VENUES:
                if tv in venue and tv.upper() not in top_venues:
                    top_venues.append(tv.upper())

    # ── Score components ──
    hw_score = _score_hardware(flight_platforms, sensor_suite, has_custom_pcb,
                               has_fpga, edge_compute)
    sw_score = _score_software(ros_version, flight_controller_sw, sim_env,
                               ci_cd, detected_sw)
    research_score = _score_research(papers_last_3yr, avg_citations,
                                     prospect.h_index, top_venues)

    overall = int(hw_score * 0.35 + sw_score * 0.30 + research_score * 0.35)

    # ── Recommendations ──
    recommendations = _generate_recommendations(
        hw_score, sw_score, research_score,
        flight_platforms, sensor_suite, has_custom_pcb, has_fpga,
        edge_compute, ros_version, sim_env,
    )

    return {
        "flight_platforms": [{"name": fp} for fp in flight_platforms],
        "sensor_suite": [{"name": s} for s in sensor_suite],
        "has_custom_pcb": has_custom_pcb,
        "has_custom_firmware": has_custom_firmware,
        "has_fpga_acceleration": has_fpga,
        "fpga_details": fpga_details,
        "edge_compute": edge_compute,
        "hardware_score": hw_score,
        "ros_version": ros_version,
        "flight_controller_sw": flight_controller_sw,
        "simulation_env": sim_env,
        "ci_cd_pipeline": ci_cd,
        "testing_framework": testing_framework,
        "software_score": sw_score,
        "papers_last_3yr": papers_last_3yr,
        "avg_citations": round(avg_citations, 1),
        "top_venues": top_venues,
        "research_score": research_score,
        "overall_score": overall,
        "recommendations": recommendations,
    }


# ═══════════════════════════════════════════════════════════════════════
# Scoring sub-functions (each 0–100)
# ═══════════════════════════════════════════════════════════════════════

def _score_hardware(platforms: list, sensors: list, custom_pcb: bool,
                    has_fpga: bool, edge: Optional[str]) -> int:
    score = 0

    # Flight platforms — more diversity = higher score
    if platforms:
        score += min(len(platforms) * 10, 30)
        # Bonus for custom builds vs. only DJI
        has_custom = any("Custom" in p or "PX4" in p or "ArduPilot" in p for p in platforms)
        if has_custom:
            score += 15
        # Penalty if ONLY DJI
        all_dji = all("DJI" in p for p in platforms)
        if all_dji:
            score -= 10

    # Sensors
    if sensors:
        score += min(len(sensors) * 5, 20)
        # Premium sensors
        premium = {"LiDAR", "Thermal", "Multispectral", "Hyperspectral", "Event Camera"}
        if any(any(p in s for p in premium) for s in sensors):
            score += 10

    # Custom hardware
    if custom_pcb:
        score += 15

    # FPGA
    if has_fpga:
        score += 15

    # Edge compute
    if edge:
        score += 10

    return min(score, 100)


def _score_software(ros_version: Optional[str], fc_sw: Optional[str],
                    sim_env: Optional[str], ci_cd: bool,
                    all_sw: list) -> int:
    score = 0

    # ROS version
    if ros_version:
        if "ROS2" in ros_version:
            score += 25
        elif "ROS1" in ros_version:
            score += 15

    # Flight controller software
    if fc_sw:
        score += 15

    # Simulation
    if sim_env:
        score += 20
        # Multiple sim environments
        sims = [s for s in all_sw if s in ("Gazebo", "AirSim", "Flightmare",
                                            "Webots", "MATLAB/Simulink")]
        if len(sims) > 1:
            score += 5

    # CI/CD
    if ci_cd:
        score += 10

    # ML/CV tools
    ml_tools = {"OpenCV", "TensorFlow", "PyTorch", "TensorRT", "NVIDIA Isaac", "ONNX"}
    ml_count = sum(1 for s in all_sw if s in ml_tools)
    score += min(ml_count * 5, 15)

    # SLAM tools
    slam_tools = {"VINS-Mono", "ORB-SLAM", "LSD-SLAM", "RTAB-Map", "Google Cartographer"}
    if any(s in all_sw for s in slam_tools):
        score += 10

    return min(score, 100)


def _score_research(papers_3yr: int, avg_cites: float,
                    h_index: Optional[int], top_venues: list) -> int:
    score = 0

    # Publication count
    if papers_3yr >= 15:
        score += 30
    elif papers_3yr >= 8:
        score += 20
    elif papers_3yr >= 3:
        score += 10
    elif papers_3yr >= 1:
        score += 5

    # Citation average
    if avg_cites >= 50:
        score += 25
    elif avg_cites >= 20:
        score += 15
    elif avg_cites >= 5:
        score += 10

    # h-index
    h = h_index or 0
    if h >= 40:
        score += 25
    elif h >= 20:
        score += 15
    elif h >= 10:
        score += 10
    elif h >= 5:
        score += 5

    # Top venues
    score += min(len(top_venues) * 5, 20)

    return min(score, 100)


# ═══════════════════════════════════════════════════════════════════════
# Recommendation generator
# ═══════════════════════════════════════════════════════════════════════

def _generate_recommendations(hw_score, sw_score, research_score,
                              platforms, sensors, custom_pcb, has_fpga,
                              edge, ros_version, sim_env) -> list[dict]:
    """Generate actionable recommendations based on audit findings."""
    recs = []

    # Hardware gaps
    if hw_score < 40:
        if not platforms or all("DJI" in p for p in platforms):
            recs.append({
                "area": "hardware",
                "priority": "high",
                "recommendation": "Transition from DJI-only to custom PX4 platform for "
                                  "reproducible research and hardware-level contributions.",
                "impact": "Enables novel hardware papers, reduces vendor lock-in",
            })
        if not any("LiDAR" in s for s in sensors):
            recs.append({
                "area": "hardware",
                "priority": "medium",
                "recommendation": "Add LiDAR sensor for 3D mapping and SLAM validation. "
                                  "Livox Mid-360 offers $500 entry point.",
                "impact": "Opens mapping/inspection research verticals",
            })

    if not custom_pcb:
        recs.append({
            "area": "hardware",
            "priority": "medium",
            "recommendation": "Custom PCB design for specialized payload integration "
                              "would strengthen NSF proposals.",
            "impact": "Novel hardware contribution for publications and grants",
        })

    if not has_fpga:
        recs.append({
            "area": "hardware",
            "priority": "high",
            "recommendation": "FPGA acceleration (Xilinx Artix-7/Zynq) could enable "
                              "real-time perception on edge with <5W power budget.",
            "impact": "10-50× latency reduction for vision processing",
        })

    if not edge:
        recs.append({
            "area": "hardware",
            "priority": "medium",
            "recommendation": "Add edge compute (NVIDIA Jetson Orin) for onboard ML inference.",
            "impact": "Enables autonomous decision-making without ground station",
        })

    # Software gaps
    if sw_score < 40:
        if not ros_version or "ROS1" in (ros_version or ""):
            recs.append({
                "area": "software",
                "priority": "high",
                "recommendation": "Migrate to ROS2 (Humble/Iron) for modern middleware, "
                                  "better real-time support, and active community.",
                "impact": "Future-proof software stack, easier collaboration",
            })
        if not sim_env:
            recs.append({
                "area": "software",
                "priority": "high",
                "recommendation": "Set up Gazebo simulation environment for SITL testing. "
                                  "Reduces flight test iterations and risk.",
                "impact": "Faster iteration, safer development, reproducible experiments",
            })

    # Research gaps
    if research_score < 40:
        recs.append({
            "area": "research",
            "priority": "medium",
            "recommendation": "Custom hardware platform would enable novel contributions "
                              "to top venues (ICRA, IROS, RAL).",
            "impact": "Hardware novelty is a strong differentiator for publication",
        })

    return recs


# ═══════════════════════════════════════════════════════════════════════
# Database operations — persist audit results
# ═══════════════════════════════════════════════════════════════════════

async def audit_prospect(prospect_id: str) -> Optional[dict]:
    """
    Run a Lab Capability Audit for a single prospect and persist results.
    Creates a new LabAudit row and updates DroneProspect summary fields.
    """
    async with async_session_factory() as db:
        prospect = await db.get(DroneProspect, prospect_id)
        if not prospect:
            logger.warning("Prospect %s not found for audit", prospect_id)
            return None

        audit_data = audit_lab_capabilities(prospect)

        # Create LabAudit record
        lab_audit = LabAudit(
            prospect_id=prospect.id,
            flight_platforms=audit_data["flight_platforms"],
            sensor_suite=audit_data["sensor_suite"],
            has_custom_pcb=audit_data["has_custom_pcb"],
            has_custom_firmware=audit_data["has_custom_firmware"],
            has_fpga_acceleration=audit_data["has_fpga_acceleration"],
            fpga_details=audit_data["fpga_details"],
            edge_compute=audit_data["edge_compute"],
            hardware_score=audit_data["hardware_score"],
            ros_version=audit_data["ros_version"],
            flight_controller_sw=audit_data["flight_controller_sw"],
            simulation_env=audit_data["simulation_env"],
            ci_cd_pipeline=audit_data["ci_cd_pipeline"],
            testing_framework=audit_data["testing_framework"],
            software_score=audit_data["software_score"],
            papers_last_3yr=audit_data["papers_last_3yr"],
            avg_citations=audit_data["avg_citations"],
            top_venues=audit_data["top_venues"],
            research_score=audit_data["research_score"],
            overall_score=audit_data["overall_score"],
            recommendations=audit_data["recommendations"],
        )
        db.add(lab_audit)

        # Update prospect summary fields
        prospect.score_hardware = audit_data["hardware_score"]
        prospect.score_software = audit_data["software_score"]
        prospect.score_research = audit_data["research_score"]
        prospect.score_overall = audit_data["overall_score"]
        prospect.has_custom_hardware = audit_data["has_custom_pcb"]
        prospect.has_fpga = audit_data["has_fpga_acceleration"]
        prospect.simulation_setup = audit_data["simulation_env"]
        prospect.primary_gap = _identify_primary_gap(audit_data)

        # Write detected capabilities back to prospect fields
        detected_hw = [fp["name"] for fp in audit_data["flight_platforms"]]
        if detected_hw and not prospect.hardware_platforms:
            prospect.hardware_platforms = detected_hw
        detected_sensors = [s["name"] for s in audit_data["sensor_suite"]]
        if detected_sensors and not prospect.sensor_types:
            prospect.sensor_types = detected_sensors
        detected_sw = []
        if audit_data["ros_version"]:
            detected_sw.append(audit_data["ros_version"])
        if audit_data["simulation_env"] and audit_data["simulation_env"] not in detected_sw:
            detected_sw.append(audit_data["simulation_env"])
        if audit_data["flight_controller_sw"] and audit_data["flight_controller_sw"] not in detected_sw:
            detected_sw.append(audit_data["flight_controller_sw"])
        if detected_sw and not prospect.software_stack:
            prospect.software_stack = detected_sw
        if audit_data["flight_controller_sw"] and not prospect.flight_controller:
            prospect.flight_controller = audit_data["flight_controller_sw"]
        # Mark has_drone_lab if any hardware/sensor was detected
        if (detected_hw or detected_sensors) and not prospect.has_drone_lab:
            prospect.has_drone_lab = True

        prospect.audited_at = datetime.now(timezone.utc)
        if prospect.status == "discovered":
            prospect.status = "audited"

        await db.commit()
        logger.info(
            "Audited %s (%s): hw=%d sw=%d research=%d overall=%d",
            prospect.name, prospect.organization,
            audit_data["hardware_score"], audit_data["software_score"],
            audit_data["research_score"], audit_data["overall_score"],
        )
        return audit_data


def _identify_primary_gap(audit: dict) -> str:
    """Determine the single biggest capability gap for email hook."""
    scores = {
        "hardware": audit["hardware_score"],
        "software": audit["software_score"],
        "research": audit["research_score"],
    }
    weakest = min(scores, key=scores.get)

    gap_messages = {
        "hardware": "Custom hardware & FPGA acceleration",
        "software": "Modern software stack (ROS2, simulation, CI/CD)",
        "research": "Publication impact and venue diversity",
    }

    # More specific gaps
    if not audit["has_fpga_acceleration"] and audit["hardware_score"] < 50:
        return "FPGA acceleration for real-time edge processing"
    if not audit["simulation_env"] and audit["software_score"] < 50:
        return "Simulation environment for reproducible testing"
    if not audit["has_custom_pcb"] and audit["hardware_score"] < 40:
        return "Custom hardware platform for novel contributions"

    return gap_messages.get(weakest, "Custom hardware & FPGA acceleration")


async def batch_audit_prospects(limit: int = 20) -> int:
    """Audit all discovered prospects that haven't been audited yet."""
    async with async_session_factory() as db:
        result = await db.execute(
            select(DroneProspect.id).where(
                DroneProspect.audited_at.is_(None),
                DroneProspect.status.in_(["discovered", "enriched"]),
            ).order_by(DroneProspect.created_at.asc()).limit(limit)
        )
        ids = [str(r[0]) for r in result.fetchall()]

    count = 0
    for pid in ids:
        r = await audit_prospect(pid)
        if r:
            count += 1
    logger.info("Batch audited %d/%d drone prospects", count, len(ids))
    return count
