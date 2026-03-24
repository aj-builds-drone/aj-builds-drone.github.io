"""
Peer Comparison Engine — compares a prospect's lab against known benchmark labs.

Produces a ranked competitive analysis showing where the prospect stands
relative to top drone research labs (MIT CSAIL, CMU AirLab, etc.).

Phase 3 of OUTREACH_STRATEGY.md (§3.2) — Competitive Position section.
"""

import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from api.database import async_session_factory
from api.models.prospect import DroneProspect, LabAudit

logger = logging.getLogger("drone.peer_comparison")


# ═══════════════════════════════════════════════════════════════════════
# Benchmark Labs — known top drone research labs with estimated scores
# ═══════════════════════════════════════════════════════════════════════

BENCHMARK_LABS = [
    {
        "name": "MIT CSAIL Drone Group",
        "organization": "MIT",
        "hardware_score": 92,
        "software_score": 95,
        "research_score": 98,
        "overall_score": 95,
        "strengths": ["Custom FPGA vision", "Swarm autonomy", "ROS2 native"],
        "platforms": ["Custom PX4", "Crazyflie Swarm"],
    },
    {
        "name": "CMU AirLab",
        "organization": "Carnegie Mellon",
        "hardware_score": 88,
        "software_score": 90,
        "research_score": 95,
        "overall_score": 91,
        "strengths": ["Autonomous navigation", "LiDAR SLAM", "Field robotics"],
        "platforms": ["Custom platforms", "DJI Matrice"],
    },
    {
        "name": "Georgia Tech IRIM Aerial Robotics",
        "organization": "Georgia Tech",
        "hardware_score": 80,
        "software_score": 85,
        "research_score": 90,
        "overall_score": 85,
        "strengths": ["Manipulation", "Multi-robot systems", "Perception"],
        "platforms": ["Custom quadrotors", "DJI platforms"],
    },
    {
        "name": "Stanford ASL",
        "organization": "Stanford",
        "hardware_score": 75,
        "software_score": 88,
        "research_score": 92,
        "overall_score": 85,
        "strengths": ["Motion planning", "Learning-based control", "Safety"],
        "platforms": ["Crazyflie", "Custom PX4"],
    },
    {
        "name": "UC Berkeley HiPeR Lab",
        "organization": "UC Berkeley",
        "hardware_score": 78,
        "software_score": 82,
        "research_score": 88,
        "overall_score": 83,
        "strengths": ["High performance robotics", "Agile flight", "SLAM"],
        "platforms": ["Custom builds", "Crazyflie"],
    },
    {
        "name": "UPenn GRASP Lab",
        "organization": "University of Pennsylvania",
        "hardware_score": 85,
        "software_score": 88,
        "research_score": 95,
        "overall_score": 89,
        "strengths": ["Aggressive flight", "Swarm coordination", "Micro UAVs"],
        "platforms": ["Custom nano-quads", "Crazyflie"],
    },
    {
        "name": "ETH Zurich ASL",
        "organization": "ETH Zurich",
        "hardware_score": 82,
        "software_score": 90,
        "research_score": 96,
        "overall_score": 89,
        "strengths": ["Visual-inertial odometry", "Autonomous exploration"],
        "platforms": ["Custom platforms", "DJI Matrice"],
    },
    {
        "name": "UMich Autonomous Aerospace Systems",
        "organization": "University of Michigan",
        "hardware_score": 72,
        "software_score": 78,
        "research_score": 82,
        "overall_score": 77,
        "strengths": ["Urban air mobility", "Multi-vehicle systems"],
        "platforms": ["DJI platforms", "Custom fixed-wing"],
    },
    {
        "name": "Virginia Tech Unmanned Systems Lab",
        "organization": "Virginia Tech",
        "hardware_score": 70,
        "software_score": 75,
        "research_score": 78,
        "overall_score": 74,
        "strengths": ["Unmanned systems", "Counter-UAS", "Autonomy"],
        "platforms": ["DJI platforms", "Custom multi-rotors"],
    },
    {
        "name": "UT Austin Aerial Robotics",
        "organization": "UT Austin",
        "hardware_score": 65,
        "software_score": 72,
        "research_score": 76,
        "overall_score": 71,
        "strengths": ["Autonomous navigation", "Sensor fusion"],
        "platforms": ["DJI Mavic", "Custom PX4"],
    },
]

# Pre-sorted by overall_score descending
BENCHMARK_LABS.sort(key=lambda x: x["overall_score"], reverse=True)


# ═══════════════════════════════════════════════════════════════════════
# Research topic → relevant benchmark mapping
# ═══════════════════════════════════════════════════════════════════════

TOPIC_BENCHMARKS = {
    "slam": ["CMU AirLab", "ETH Zurich ASL", "UC Berkeley HiPeR Lab"],
    "visual slam": ["ETH Zurich ASL", "CMU AirLab", "UC Berkeley HiPeR Lab"],
    "swarm": ["MIT CSAIL Drone Group", "UPenn GRASP Lab"],
    "multi-robot": ["MIT CSAIL Drone Group", "UPenn GRASP Lab", "Georgia Tech IRIM Aerial Robotics"],
    "fpga": ["MIT CSAIL Drone Group"],
    "path planning": ["Stanford ASL", "CMU AirLab"],
    "motion planning": ["Stanford ASL", "CMU AirLab"],
    "perception": ["Georgia Tech IRIM Aerial Robotics", "CMU AirLab", "ETH Zurich ASL"],
    "manipulation": ["Georgia Tech IRIM Aerial Robotics"],
    "agile flight": ["UPenn GRASP Lab", "UC Berkeley HiPeR Lab"],
    "aggressive flight": ["UPenn GRASP Lab", "UC Berkeley HiPeR Lab"],
    "autonomous": ["Stanford ASL", "CMU AirLab", "Virginia Tech Unmanned Systems Lab"],
    "navigation": ["CMU AirLab", "Stanford ASL"],
    "lidar": ["CMU AirLab", "ETH Zurich ASL"],
    "mapping": ["CMU AirLab", "ETH Zurich ASL"],
    "learning": ["Stanford ASL", "UC Berkeley HiPeR Lab"],
    "reinforcement learning": ["Stanford ASL", "UC Berkeley HiPeR Lab"],
    "control": ["Stanford ASL", "UPenn GRASP Lab"],
}


def _find_relevant_peers(prospect: DroneProspect) -> list[dict]:
    """Find the most relevant peer/benchmark labs based on research topics."""
    research_areas = [a.lower() for a in (prospect.research_areas or [])]

    # Also extract topics from paper titles
    for paper in (prospect.recent_papers or []):
        if isinstance(paper, dict):
            title = (paper.get("title") or "").lower()
            for topic in TOPIC_BENCHMARKS:
                if topic in title:
                    if topic not in research_areas:
                        research_areas.append(topic)

    # Score each benchmark by relevance
    bench_scores: dict[str, int] = {}
    for area in research_areas:
        for topic, labs in TOPIC_BENCHMARKS.items():
            if topic in area or area in topic:
                for lab_name in labs:
                    bench_scores[lab_name] = bench_scores.get(lab_name, 0) + 1

    # Sort by relevance score, then add top-3 benchmarks regardless
    relevant = []
    seen = set()

    # First: topic-matched labs
    for lab_name, _ in sorted(bench_scores.items(), key=lambda x: x[1], reverse=True):
        for bench in BENCHMARK_LABS:
            if bench["name"] == lab_name and lab_name not in seen:
                relevant.append(bench)
                seen.add(lab_name)
                break

    # Then: fill with top overall labs if we don't have enough
    for bench in BENCHMARK_LABS:
        if len(relevant) >= 5:
            break
        if bench["name"] not in seen:
            relevant.append(bench)
            seen.add(bench["name"])

    return relevant[:5]


def compare_prospect_to_peers(prospect: DroneProspect,
                              audit_data: Optional[dict] = None) -> dict:
    """
    Compare a prospect's lab capabilities against benchmark labs.

    Args:
        prospect: DroneProspect with audit scores populated
        audit_data: Optional fresh audit dict (if not yet persisted)

    Returns:
        {
            "peer_labs": [...],        # Ranked list of peer comparisons
            "prospect_score": int,     # Prospect's overall score
            "competitive_rank": int,   # Rank among peers (1 = best)
            "competitive_gap": str,    # Description of biggest gap
            "competitive_position": str,  # "leader" | "competitive" | "developing" | "emerging"
        }
    """
    # Get prospect's scores
    hw = (audit_data["hardware_score"] if audit_data else None) or (prospect.score_hardware or 0)
    sw = (audit_data["software_score"] if audit_data else None) or (prospect.score_software or 0)
    rs = (audit_data["research_score"] if audit_data else None) or (prospect.score_research or 0)
    overall = (audit_data["overall_score"] if audit_data else None) or (prospect.score_overall or 0)

    # Find relevant peers
    peers = _find_relevant_peers(prospect)

    # Build comparison
    peer_comparison = []
    for peer in peers:
        peer_comparison.append({
            "name": peer["name"],
            "organization": peer["organization"],
            "overall_score": peer["overall_score"],
            "hardware_score": peer["hardware_score"],
            "software_score": peer["software_score"],
            "research_score": peer["research_score"],
            "strengths": peer["strengths"],
            "hw_delta": hw - peer["hardware_score"],
            "sw_delta": sw - peer["software_score"],
            "research_delta": rs - peer["research_score"],
            "overall_delta": overall - peer["overall_score"],
        })

    # Sort peers by overall score descending
    peer_comparison.sort(key=lambda x: x["overall_score"], reverse=True)

    # Calculate rank (1-based, where does prospect fit?)
    all_scores = [p["overall_score"] for p in peer_comparison] + [overall]
    all_scores.sort(reverse=True)
    rank = all_scores.index(overall) + 1

    # Competitive position
    if overall >= 85:
        position = "leader"
    elif overall >= 65:
        position = "competitive"
    elif overall >= 45:
        position = "developing"
    else:
        position = "emerging"

    # Identify biggest gap vs. nearest better peer
    gap = "Custom hardware & FPGA acceleration"  # default
    better_peers = [p for p in peer_comparison if p["overall_score"] > overall]
    if better_peers:
        nearest = better_peers[-1]  # closest better peer
        deltas = {
            "hardware": nearest["hardware_score"] - hw,
            "software": nearest["software_score"] - sw,
            "research": nearest["research_score"] - rs,
        }
        biggest_gap_area = max(deltas, key=deltas.get)
        gap_descriptions = {
            "hardware": "Custom hardware & FPGA acceleration",
            "software": "Modern software stack (ROS2, simulation, CI/CD)",
            "research": "Publication impact and venue diversity",
        }
        gap = gap_descriptions.get(biggest_gap_area, gap)

    return {
        "peer_labs": peer_comparison,
        "prospect_score": overall,
        "competitive_rank": rank,
        "competitive_gap": gap,
        "competitive_position": position,
    }


async def update_prospect_peer_comparison(prospect_id: str) -> Optional[dict]:
    """Fetch prospect, run peer comparison, and persist results."""
    async with async_session_factory() as db:
        prospect = await db.get(
            DroneProspect, prospect_id,
            options=[selectinload(DroneProspect.audits)],
        )
        if not prospect:
            logger.warning("Prospect %s not found for peer comparison", prospect_id)
            return None

        # Use latest audit if available
        audit_data = None
        if prospect.audits:
            latest = sorted(prospect.audits, key=lambda a: a.audited_at or a.id, reverse=True)[0]
            audit_data = latest.to_dict()

        result = compare_prospect_to_peers(prospect, audit_data)

        # Persist to prospect
        prospect.peer_labs = result["peer_labs"]
        prospect.primary_gap = result["competitive_gap"]
        prospect.competitive_position = result["competitive_position"]

        # Also update the LabAudit if exists
        if prospect.audits:
            latest = sorted(prospect.audits, key=lambda a: a.audited_at or a.id, reverse=True)[0]
            latest.peer_comparison = result["peer_labs"]
            latest.competitive_gap = result["competitive_gap"]
            latest.competitive_rank = result["competitive_rank"]

        await db.commit()
        logger.info(
            "Peer comparison for %s: rank=%d position=%s gap='%s'",
            prospect.name, result["competitive_rank"],
            result["competitive_position"], result["competitive_gap"],
        )
        return result
