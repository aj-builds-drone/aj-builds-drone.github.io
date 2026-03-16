"""
Research Analyzer Agent — Deep paper/topic analysis for personalized outreach.

Analyzes each prospect's publications and research areas to find the most
relevant connection to AJ's drone/embedded/FPGA expertise. Stores analysis
in prospect.enrichment["research_analysis"] for the template engine to use.

This is the difference between "I read your sleep scoring paper — the UAV
approach is fascinating" (cringe) and a genuine, informed outreach email.

Runs continuously in the background on a 2-hour cycle.
"""

import logging
import re
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List

from sqlalchemy import select, and_
from sqlalchemy.orm.attributes import flag_modified

from api.database import async_session_factory
from api.models.prospect import DroneProspect

logger = logging.getLogger("drone.agents.research_analyzer")


# ─── Relevance keyword banks ──────────────────────────────────────────
# Weighted: higher weight = stronger relevance to AJ's offering

DRONE_KEYWORDS = {
    # Direct drone terms (weight 10)
    "drone": 10, "uav": 10, "uas": 10, "unmanned aerial": 10,
    "quadrotor": 10, "quadcopter": 10, "multirotor": 10, "hexacopter": 10,
    "octocopter": 10, "rotorcraft": 9, "vtol": 9, "fixed-wing uav": 10,
    "aerial robot": 9, "flying robot": 9, "micro air vehicle": 9, "mav": 8,
    "aerial vehicle": 8, "sUAS": 10, "rpas": 8,

    # Flight systems (weight 8-9)
    "flight controller": 9, "pixhawk": 9, "px4": 10, "ardupilot": 9,
    "betaflight": 8, "inav": 8, "autopilot": 8, "flight control": 8,
    "attitude control": 7, "trajectory planning": 7, "path planning": 7,
    "waypoint": 7, "mission planning": 7, "return to home": 8,
    "geofencing": 7, "airspace": 7, "utm": 7, "sense and avoid": 8,
    "detect and avoid": 8, "collision avoidance": 7, "obstacle avoidance": 7,

    # FPGA / embedded (weight 8-10) — AJ's core expertise
    "fpga": 10, "vhdl": 9, "verilog": 9, "systemverilog": 9,
    "xilinx": 9, "altera": 8, "intel fpga": 9, "vivado": 8,
    "embedded system": 8, "real-time processing": 8, "edge computing": 8,
    "edge ai": 8, "stm32": 9, "arm cortex": 7, "microcontroller": 7,
    "pcb design": 9, "custom hardware": 9, "hardware acceleration": 9,
    "neural accelerator": 8, "inference engine": 7,

    # Computer vision on drones (weight 7-8)
    "aerial imagery": 8, "aerial perception": 8, "onboard vision": 8,
    "visual odometry": 7, "visual slam": 7, "lidar slam": 7,
    "depth estimation": 6, "stereo vision": 6, "object detection": 5,
    "semantic segmentation": 5, "optical flow": 6, "feature tracking": 6,

    # Simulation / testing (weight 6-7)
    "gazebo": 8, "airsim": 7, "sitl": 8, "hitl": 8, "jmavsim": 7,
    "flightmare": 7, "ros": 7, "ros2": 8, "mavlink": 8, "mavros": 8,
    "robot operating system": 7, "simulation": 5,

    # Sensors relevant to drones (weight 5-6)
    "imu": 6, "gps": 5, "gnss": 5, "barometer": 5, "magnetometer": 5,
    "lidar": 6, "radar": 5, "ultrasonic": 5, "sensor fusion": 7,
    "kalman filter": 6, "state estimation": 6, "localization": 5,

    # Broader embedded / hardware topics (weight 4-6)
    "soc": 5, "system-on-chip": 5, "asic": 5, "digital signal processing": 5,
    "dsp": 5, "power electronics": 5, "motor control": 6, "esc": 6,
    "brushless motor": 7, "propulsion": 6, "aerodynamics": 5,
    "control systems": 5, "pid control": 6, "model predictive control": 6,
    "reinforcement learning": 4, "swarm": 6, "multi-agent": 5,
    "cooperative": 4, "formation": 5, "autonomous navigation": 7,
    "autonomous": 4, "robotics": 4,
}

# Topics that are NOT relevant — if these dominate, the paper is off-topic
IRRELEVANT_SIGNALS = [
    "sleep", "eeg", "brain", "medical imaging", "cancer", "clinical",
    "genomic", "protein", "bioinformatics", "drug", "pharmaceutical",
    "social media", "natural language", "sentiment analysis", "text mining",
    "stock market", "financial", "blockchain", "cryptocurrency",
    "music", "art generation", "style transfer",
]

# AJ's specific capabilities — used to find genuine hooks
AJ_CAPABILITIES = {
    "fpga_design": {
        "keywords": ["fpga", "vhdl", "verilog", "hardware acceleration", "xilinx",
                     "vivado", "custom hardware", "pcb design", "edge computing"],
        "pitch": "FPGA-accelerated edge processing for real-time onboard compute",
    },
    "flight_controller": {
        "keywords": ["flight controller", "px4", "ardupilot", "stm32", "autopilot",
                     "attitude control", "motor control", "esc", "brushless"],
        "pitch": "custom flight controller design and PX4/ArduPilot integration",
    },
    "simulation": {
        "keywords": ["gazebo", "sitl", "hitl", "simulation", "airsim", "ros",
                     "testing", "validation", "digital twin"],
        "pitch": "Gazebo SITL/HITL testing pipeline for reproducible research",
    },
    "perception": {
        "keywords": ["computer vision", "object detection", "slam", "lidar",
                     "depth estimation", "visual odometry", "perception", "sensor fusion"],
        "pitch": "FPGA-accelerated perception pipeline for low-latency onboard processing",
    },
    "platform_design": {
        "keywords": ["drone design", "airframe", "propulsion", "aerodynamic",
                     "payload", "custom platform", "multi-rotor", "fixed-wing"],
        "pitch": "custom drone platform design tailored to your research requirements",
    },
}


def _score_text_relevance(text: str) -> Dict[str, Any]:
    """Score a text block for drone/embedded relevance."""
    text_lower = text.lower()

    # Check irrelevant signals first
    irrelevant_hits = sum(1 for kw in IRRELEVANT_SIGNALS if kw in text_lower)
    if irrelevant_hits >= 3:
        return {"score": 0, "keywords_found": [], "is_irrelevant": True,
                "irrelevant_count": irrelevant_hits}

    # Score relevant keywords
    keywords_found = []
    total_score = 0
    for kw, weight in DRONE_KEYWORDS.items():
        # Use word boundary matching for short keywords to avoid false positives
        if len(kw) <= 3:
            pattern = r'\b' + re.escape(kw) + r'\b'
            if re.search(pattern, text_lower):
                keywords_found.append(kw)
                total_score += weight
        else:
            if kw in text_lower:
                keywords_found.append(kw)
                total_score += weight

    # Find which AJ capability is the best match
    best_capability = None
    best_cap_score = 0
    for cap_name, cap_data in AJ_CAPABILITIES.items():
        cap_score = sum(1 for kw in cap_data["keywords"] if kw in text_lower)
        if cap_score > best_cap_score:
            best_cap_score = cap_score
            best_capability = cap_name

    return {
        "score": total_score,
        "keywords_found": keywords_found[:15],  # top matches
        "is_irrelevant": False,
        "best_capability_match": best_capability,
        "capability_score": best_cap_score,
    }


def _analyze_papers(papers: List) -> Dict[str, Any]:
    """Analyze a list of papers and find the most drone-relevant one."""
    if not papers:
        return {"best_paper": None, "best_score": 0, "analyzed": 0}

    best_paper = None
    best_score = 0
    best_analysis = None
    analyzed = 0

    for paper in papers:
        if isinstance(paper, str):
            paper = {"title": paper}

        title = paper.get("title", "")
        # Also consider abstract/snippet if available
        text = title
        if paper.get("abstract"):
            text += " " + paper["abstract"]
        if paper.get("snippet"):
            text += " " + paper["snippet"]

        analysis = _score_text_relevance(text)
        analyzed += 1

        if analysis["score"] > best_score and not analysis["is_irrelevant"]:
            best_score = analysis["score"]
            best_paper = paper
            best_analysis = analysis

    return {
        "best_paper": best_paper,
        "best_score": best_score,
        "best_analysis": best_analysis,
        "analyzed": analyzed,
        "total_papers": len(papers),
    }


def _analyze_research_areas(areas: List[str]) -> Dict[str, Any]:
    """Analyze research areas for drone/embedded relevance."""
    if not areas:
        return {"relevant_areas": [], "best_area": None, "relevance_score": 0}

    scored_areas = []
    for area in areas:
        analysis = _score_text_relevance(area)
        scored_areas.append({
            "area": area,
            "score": analysis["score"],
            "is_relevant": analysis["score"] > 0 and not analysis["is_irrelevant"],
        })

    scored_areas.sort(key=lambda x: x["score"], reverse=True)
    relevant = [a for a in scored_areas if a["is_relevant"]]

    return {
        "relevant_areas": [a["area"] for a in relevant[:5]],
        "all_scored": scored_areas,
        "best_area": relevant[0]["area"] if relevant else None,
        "relevance_score": relevant[0]["score"] if relevant else 0,
    }


def _generate_hook(paper_analysis: Dict, area_analysis: Dict,
                   prospect: DroneProspect) -> Dict[str, Any]:
    """Generate the personalized email hook — what to reference and how."""
    best_paper = paper_analysis.get("best_paper")
    best_area = area_analysis.get("best_area")
    paper_score = paper_analysis.get("best_score", 0)
    area_score = area_analysis.get("relevance_score", 0)

    # Determine best AJ capability match
    capability_match = None
    if paper_analysis.get("best_analysis"):
        capability_match = paper_analysis["best_analysis"].get("best_capability_match")
    if not capability_match and best_area:
        area_text_analysis = _score_text_relevance(best_area)
        capability_match = area_text_analysis.get("best_capability_match")

    capability_pitch = ""
    if capability_match and capability_match in AJ_CAPABILITIES:
        capability_pitch = AJ_CAPABILITIES[capability_match]["pitch"]

    # Build the hook
    hook = {
        "quality": "none",  # none | weak | good | strong
        "paper_to_reference": None,
        "paper_title": None,
        "technique_to_mention": None,
        "connection_to_aj": capability_pitch or "technical collaboration on drone research",
        "capability_match": capability_match,
        "genuine_interest": None,  # What about their work is genuinely interesting for drones
    }

    # Strong: We have a directly relevant paper with good score
    if best_paper and paper_score >= 20:
        paper_title = best_paper.get("title", "") if isinstance(best_paper, dict) else str(best_paper)
        hook["quality"] = "strong"
        hook["paper_to_reference"] = best_paper
        hook["paper_title"] = paper_title
        hook["technique_to_mention"] = best_area or _extract_technique(paper_title)
        hook["genuine_interest"] = _describe_interest(paper_title, capability_match)

    # Good: Relevant research area even if specific paper is weak
    elif best_area and area_score >= 10:
        hook["quality"] = "good"
        hook["technique_to_mention"] = best_area
        hook["genuine_interest"] = f"Your work in {best_area} aligns with challenges I see in drone systems"
        if best_paper and paper_score >= 5:
            paper_title = best_paper.get("title", "") if isinstance(best_paper, dict) else str(best_paper)
            hook["paper_to_reference"] = best_paper
            hook["paper_title"] = paper_title

    # Weak: Some tangential relevance
    elif best_paper and paper_score >= 5:
        paper_title = best_paper.get("title", "") if isinstance(best_paper, dict) else str(best_paper)
        hook["quality"] = "weak"
        hook["paper_to_reference"] = best_paper
        hook["paper_title"] = paper_title
        hook["technique_to_mention"] = best_area or _extract_technique(paper_title)
        hook["genuine_interest"] = f"The techniques in your work could have interesting applications for drone systems"

    # Check enrichment text for additional drone signals
    elif prospect.enrichment:
        lab_text = prospect.enrichment.get("lab_page_text", "")
        faculty_text = prospect.enrichment.get("faculty_page_text", "")
        combined = lab_text + " " + faculty_text
        if combined.strip():
            text_analysis = _score_text_relevance(combined)
            if text_analysis["score"] >= 10:
                hook["quality"] = "weak"
                hook["capability_match"] = text_analysis.get("best_capability_match")
                hook["technique_to_mention"] = best_area or "drone research"
                hook["genuine_interest"] = "Your lab's work intersects with drone technology challenges I work on"

    return hook


def _extract_technique(paper_title: str) -> str:
    """Extract a short technique/approach phrase from a paper title."""
    # Try to get the part before a colon or dash
    for sep in [":", "—", " - ", "–"]:
        if sep in paper_title:
            parts = paper_title.split(sep)
            # Usually the method name is the shorter part
            return min(parts, key=len).strip()[:60]
    # Just use the title truncated
    return paper_title[:60]


def _describe_interest(paper_title: str, capability: Optional[str]) -> str:
    """Generate a genuine interest statement connecting paper to drones."""
    title_lower = paper_title.lower()

    if any(kw in title_lower for kw in ["fpga", "hardware acceleration", "edge"]):
        return "the hardware acceleration approach could dramatically reduce onboard latency"
    if any(kw in title_lower for kw in ["slam", "visual odometry", "localization"]):
        return "real-time localization is one of the biggest challenges in GPS-denied drone flight"
    if any(kw in title_lower for kw in ["object detection", "perception", "segmentation"]):
        return "onboard perception at low latency is critical for autonomous drone operations"
    if any(kw in title_lower for kw in ["control", "trajectory", "path planning"]):
        return "the control approach is exactly what's needed for reliable autonomous flight"
    if any(kw in title_lower for kw in ["swarm", "multi-agent", "cooperative"]):
        return "multi-drone coordination is one of the most challenging open problems"
    if any(kw in title_lower for kw in ["simulation", "gazebo", "digital twin"]):
        return "reproducible simulation environments are what separates rigorous drone research from ad-hoc testing"
    if any(kw in title_lower for kw in ["sensor fusion", "kalman", "state estimation"]):
        return "reliable state estimation is the foundation of every autonomous flight system"
    if any(kw in title_lower for kw in ["reinforcement learning", "deep learning", "neural"]):
        return "deploying learned policies on resource-constrained flight hardware is a fascinating challenge"

    return "the approach has interesting implications for embedded drone systems"


async def analyze_prospect_research(prospect_id: str) -> Dict[str, Any]:
    """
    Analyze a single prospect's research for drone/embedded relevance.
    Stores results in prospect.enrichment["research_analysis"].
    """
    async with async_session_factory() as db:
        prospect = await db.get(DroneProspect, prospect_id)
        if not prospect:
            return {"error": "not_found"}

        papers = prospect.recent_papers or []
        areas = prospect.research_areas or []

        paper_analysis = _analyze_papers(papers)
        area_analysis = _analyze_research_areas(areas)
        hook = _generate_hook(paper_analysis, area_analysis, prospect)

        analysis = {
            "analyzed_at": datetime.now(timezone.utc).isoformat(),
            "paper_count": len(papers),
            "area_count": len(areas),
            "best_paper_score": paper_analysis["best_score"],
            "best_area_score": area_analysis["relevance_score"],
            "relevant_areas": area_analysis["relevant_areas"],
            "best_paper": paper_analysis.get("best_paper"),
            "hook": hook,
        }

        # Store in enrichment JSONB
        enrichment = dict(prospect.enrichment or {})
        enrichment["research_analysis"] = analysis
        prospect.enrichment = enrichment
        flag_modified(prospect, "enrichment")
        await db.commit()

        logger.info(
            "Analyzed %s: hook_quality=%s, paper_score=%d, area_score=%d, paper=%s",
            prospect.name, hook["quality"], paper_analysis["best_score"],
            area_analysis["relevance_score"],
            hook.get("paper_title", "none")[:50] if hook.get("paper_title") else "none"
        )

        return analysis


async def execute_research_analysis_cycle(batch_size: int = 50) -> Dict[str, Any]:
    """
    Execute one Research Analyzer Agent cycle.

    Finds prospects that have papers/research areas but haven't been analyzed yet.
    Prioritizes prospects with email addresses (they're closer to outreach).
    """
    logger.info("[ResearchAnalyzer] Starting cycle — batch_size=%d", batch_size)

    async with async_session_factory() as db:
        # Prospects with email + papers/areas but no research_analysis yet
        result = await db.execute(
            select(DroneProspect.id, DroneProspect.enrichment).where(
                DroneProspect.email.isnot(None),
            ).order_by(
                DroneProspect.priority_score.desc().nullslast()
            ).limit(batch_size * 2)  # fetch more, filter in Python
        )
        rows = result.fetchall()

    # Filter to those without research_analysis
    ids_to_analyze = []
    for row in rows:
        enrichment = row[1] or {}
        if "research_analysis" not in enrichment:
            ids_to_analyze.append(str(row[0]))
        if len(ids_to_analyze) >= batch_size:
            break

    # If all email prospects are done, also analyze non-email prospects
    if len(ids_to_analyze) < batch_size:
        async with async_session_factory() as db:
            result = await db.execute(
                select(DroneProspect.id, DroneProspect.enrichment).where(
                    DroneProspect.email.is_(None),
                ).order_by(
                    DroneProspect.priority_score.desc().nullslast()
                ).limit(batch_size * 2)
            )
            rows = result.fetchall()
        for row in rows:
            enrichment = row[1] or {}
            if "research_analysis" not in enrichment:
                ids_to_analyze.append(str(row[0]))
            if len(ids_to_analyze) >= batch_size:
                break

    analyzed = 0
    strong = 0
    good = 0
    weak = 0
    no_hook = 0

    for pid in ids_to_analyze:
        try:
            result = await analyze_prospect_research(pid)
            if result.get("error"):
                continue
            analyzed += 1
            quality = result.get("hook", {}).get("quality", "none")
            if quality == "strong":
                strong += 1
            elif quality == "good":
                good += 1
            elif quality == "weak":
                weak += 1
            else:
                no_hook += 1
        except Exception as e:
            logger.error("[ResearchAnalyzer] Error analyzing %s: %s", pid, e)

    log_output = (
        f"Research analysis cycle completed:\n"
        f"  - Analyzed: {analyzed}\n"
        f"  - Strong hooks: {strong}\n"
        f"  - Good hooks: {good}\n"
        f"  - Weak hooks: {weak}\n"
        f"  - No hook: {no_hook}"
    )
    logger.info(log_output)

    return {
        "analyzed": analyzed,
        "strong": strong,
        "good": good,
        "weak": weak,
        "no_hook": no_hook,
        "log": log_output,
    }
