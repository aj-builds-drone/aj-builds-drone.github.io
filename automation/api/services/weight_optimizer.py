"""
Scoring Weight Optimizer — Iterate scoring weights based on reply data.

Analyzes which scoring signals correlate with actual engagement (opens, replies,
meetings) and suggests weight adjustments to improve outreach targeting.

Uses regression-style analysis on prospect features vs. engagement outcomes
to recommend which scoring signals to increase/decrease.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import async_session_factory
from api.models.prospect import DroneProspect, OutreachEmail

logger = logging.getLogger("drone.weight_optimizer")


# ═══════════════════════════════════════════════════════════════════════
# Feature Extraction — convert prospect to scoring-relevant features
# ═══════════════════════════════════════════════════════════════════════

def _extract_features(prospect: DroneProspect) -> dict:
    """Extract binary/numeric features from a prospect for analysis."""
    return {
        "has_custom_hardware": bool(prospect.has_custom_hardware),
        "has_fpga": bool(prospect.has_fpga),
        "has_drone_lab": bool(prospect.has_drone_lab),
        "has_simulation": (prospect.simulation_setup or "").lower() not in ("none", "unknown", ""),
        "h_index_high": (prospect.h_index or 0) >= 30,
        "h_index_mid": 10 <= (prospect.h_index or 0) < 30,
        "grant_large": (prospect.total_grant_funding or 0) > 200_000,
        "grant_medium": 50_000 < (prospect.total_grant_funding or 0) <= 200_000,
        "grant_any": bool(prospect.active_grants),
        "org_university": (prospect.organization_type or "") == "university",
        "org_government": (prospect.organization_type or "") == "government",
        "org_defense": (prospect.organization_type or "") == "defense_contractor",
        "org_startup": (prospect.organization_type or "") == "startup",
        "lab_large": (prospect.lab_students_count or 0) >= 10,
        "lab_small": 0 < (prospect.lab_students_count or 0) < 3,
        "sensor_basic": len(prospect.sensor_types or []) <= 1,
        "low_pub_rate": 0 < float(prospect.publication_rate or 0) < 2,
        "source_scholar": prospect.source == "scholar",
        "source_nsf": prospect.source == "nsf",
        "source_github": prospect.source == "github",
        "source_sam_gov": prospect.source == "sam_gov",
        "tier_hot": prospect.tier == "hot",
        "tier_warm": prospect.tier == "warm",
    }


# ═══════════════════════════════════════════════════════════════════════
# Engagement Analysis — correlate features with outcomes
# ═══════════════════════════════════════════════════════════════════════

async def analyze_engagement() -> dict:
    """
    Analyze which prospect features correlate with engagement outcomes.

    Returns feature-level stats:
    - For each feature: { present_reply_rate, absent_reply_rate, lift, recommendation }
    """
    async with async_session_factory() as db:
        # Get all contacted prospects with engagement data
        result = await db.execute(
            select(DroneProspect)
            .where(DroneProspect.emails_sent > 0)
        )
        prospects = result.scalars().all()

    if len(prospects) < 20:
        return {"error": "Insufficient data — need at least 20 contacted prospects", "total": len(prospects)}

    # Build feature matrix with outcomes
    rows = []
    for p in prospects:
        features = _extract_features(p)
        features["_opened"] = (p.emails_opened or 0) > 0
        features["_replied"] = p.replied_at is not None
        features["_meeting"] = p.meeting_scheduled_at is not None
        rows.append(features)

    total = len(rows)
    replied_total = sum(1 for r in rows if r["_replied"])
    base_reply_rate = replied_total / total if total else 0

    # Analyze each feature
    analysis = {}
    feature_keys = [k for k in rows[0].keys() if not k.startswith("_")]

    for feature in feature_keys:
        present = [r for r in rows if r[feature]]
        absent = [r for r in rows if not r[feature]]

        if len(present) < 3 or len(absent) < 3:
            continue  # Skip features with too few samples

        present_reply = sum(1 for r in present if r["_replied"]) / len(present)
        absent_reply = sum(1 for r in absent if r["_replied"]) / len(absent)
        present_open = sum(1 for r in present if r["_opened"]) / len(present)
        absent_open = sum(1 for r in absent if r["_opened"]) / len(absent)

        lift = (present_reply - absent_reply) / max(absent_reply, 0.01)

        # Recommendation based on lift
        if lift > 0.3:
            rec = "increase_weight"
        elif lift < -0.3:
            rec = "decrease_weight"
        else:
            rec = "keep"

        analysis[feature] = {
            "present_count": len(present),
            "absent_count": len(absent),
            "present_open_rate": round(present_open * 100, 1),
            "absent_open_rate": round(absent_open * 100, 1),
            "present_reply_rate": round(present_reply * 100, 1),
            "absent_reply_rate": round(absent_reply * 100, 1),
            "lift": round(lift * 100, 1),
            "recommendation": rec,
        }

    # Sort by absolute lift (most impactful first)
    sorted_analysis = dict(sorted(analysis.items(), key=lambda x: abs(x[1]["lift"]), reverse=True))

    return {
        "total_prospects": total,
        "total_replied": replied_total,
        "base_reply_rate": round(base_reply_rate * 100, 1),
        "features": sorted_analysis,
        "suggestions": _generate_suggestions(sorted_analysis),
    }


def _generate_suggestions(analysis: dict) -> list[str]:
    """Generate human-readable weight adjustment suggestions."""
    suggestions = []
    for feature, data in analysis.items():
        if data["recommendation"] == "increase_weight":
            suggestions.append(
                f"↑ Increase weight for '{feature}': "
                f"{data['present_reply_rate']}% reply rate when present vs "
                f"{data['absent_reply_rate']}% when absent (+{data['lift']}% lift)"
            )
        elif data["recommendation"] == "decrease_weight":
            suggestions.append(
                f"↓ Decrease weight for '{feature}': "
                f"{data['present_reply_rate']}% reply rate when present vs "
                f"{data['absent_reply_rate']}% when absent ({data['lift']}% lift)"
            )
    return suggestions[:10]  # Top 10 most impactful


# ═══════════════════════════════════════════════════════════════════════
# Source Performance — which discovery sources produce best leads
# ═══════════════════════════════════════════════════════════════════════

async def analyze_source_performance() -> dict:
    """
    Compare engagement rates across discovery sources.
    Helps decide where to invest more crawling effort.
    """
    async with async_session_factory() as db:
        result = await db.execute(
            select(
                DroneProspect.source,
                func.count(DroneProspect.id).label("total"),
                func.count(
                    func.nullif(DroneProspect.emails_sent, 0)
                ).label("contacted"),
                func.sum(
                    func.coalesce(DroneProspect.emails_opened, 0)
                ).label("opens"),
                func.count(DroneProspect.replied_at).label("replied"),
                func.count(DroneProspect.meeting_scheduled_at).label("meetings"),
                func.avg(DroneProspect.priority_score).label("avg_score"),
            )
            .group_by(DroneProspect.source)
        )

        sources = {}
        for row in result.fetchall():
            source = row[0] or "unknown"
            total = row[1]
            contacted = row[2]
            sources[source] = {
                "total_discovered": total,
                "contacted": contacted,
                "opens": row[3] or 0,
                "replied": row[4],
                "meetings": row[5],
                "avg_score": round(float(row[6] or 0), 1),
                "reply_rate": round(row[4] / contacted * 100, 1) if contacted else 0,
                "meeting_rate": round(row[5] / contacted * 100, 1) if contacted else 0,
            }

    return sources
