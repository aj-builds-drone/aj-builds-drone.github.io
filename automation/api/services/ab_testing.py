"""
A/B Test Framework — Template variant testing for drone outreach emails.

Assigns prospects to email template variants, tracks performance per variant,
and provides analytics to determine which templates produce better engagement.

Uses the existing OutreachEmail.personalization JSONB field to store variant
metadata and the existing template_id field to identify the variant.
"""

import hashlib
import logging
import random
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import async_session_factory
from api.models.prospect import OutreachEmail, OutreachSequence, DroneProspect

logger = logging.getLogger("drone.ab_testing")


# ═══════════════════════════════════════════════════════════════════════
# Variant Assignment — deterministic by prospect_id
# ═══════════════════════════════════════════════════════════════════════

def assign_variant(prospect_id: str, experiment_name: str, variants: list[str]) -> str:
    """
    Deterministically assign a prospect to a variant using consistent hashing.
    Same prospect always gets the same variant for a given experiment.

    Args:
        prospect_id: UUID string of the prospect
        experiment_name: e.g. "step1_subject_line_v2"
        variants: e.g. ["control", "variant_a", "variant_b"]

    Returns: The assigned variant name
    """
    if not variants:
        return "control"
    key = f"{prospect_id}:{experiment_name}"
    h = int(hashlib.sha256(key.encode()).hexdigest(), 16)
    return variants[h % len(variants)]


# ═══════════════════════════════════════════════════════════════════════
# Experiment Configuration
# ═══════════════════════════════════════════════════════════════════════

# Active experiments — each maps experiment_name → {step, variants, field}
# The "field" indicates what changes between variants
ACTIVE_EXPERIMENTS = {
    "step1_subject": {
        "step": 1,
        "field": "subject",
        "variants": {
            "control": "Lab Capability Assessment: {organization}",
            "variant_a": "Quick question about your drone research, {last_name}",
            "variant_b": "{organization} Drone Lab — Free Capability Report",
        },
    },
    "step1_template": {
        "step": 1,
        "field": "template",
        "variants": {
            "control": "lab_capability_audit",
            "variant_a": "lab_capability_audit_short",
        },
    },
}


def get_experiment_for_step(step: int) -> list[dict]:
    """Return all active experiments for a given sequence step."""
    return [
        {"name": name, **exp}
        for name, exp in ACTIVE_EXPERIMENTS.items()
        if exp["step"] == step
    ]


def apply_variant(
    prospect_id: str,
    step: int,
    subject: str,
    template_id: str,
    personalization: dict,
) -> tuple[str, str, dict]:
    """
    Apply A/B test variants to an email before creation.

    Returns: (modified_subject, modified_template_id, modified_personalization)
    """
    experiments = get_experiment_for_step(step)
    ab_metadata = {}

    for exp in experiments:
        variant_names = list(exp["variants"].keys())
        assigned = assign_variant(prospect_id, exp["name"], variant_names)
        ab_metadata[exp["name"]] = assigned

        if exp["field"] == "subject":
            # Replace subject with variant's subject template
            variant_subject = exp["variants"][assigned]
            # Substitute variables from personalization
            for key, val in personalization.items():
                variant_subject = variant_subject.replace("{" + key + "}", str(val))
            subject = variant_subject

        elif exp["field"] == "template":
            template_id = exp["variants"][assigned]

    # Store variant assignments in personalization for tracking
    personalization = {**personalization, "_ab_variants": ab_metadata}

    return subject, template_id, personalization


# ═══════════════════════════════════════════════════════════════════════
# Analytics — variant performance comparison
# ═══════════════════════════════════════════════════════════════════════

async def get_experiment_results(experiment_name: str = None) -> dict:
    """
    Calculate performance metrics for A/B test variants.

    Returns per-variant: sent, opened, clicked, replied, open_rate, click_rate, reply_rate
    """
    async with async_session_factory() as db:
        # Get all sent emails with A/B metadata
        result = await db.execute(
            select(OutreachEmail)
            .where(OutreachEmail.status == "sent")
            .where(OutreachEmail.personalization.isnot(None))
        )
        emails = result.scalars().all()

    # Group by experiment → variant → metrics
    experiments = {}
    for email in emails:
        p = email.personalization or {}
        ab_variants = p.get("_ab_variants", {})
        if not ab_variants:
            continue

        for exp_name, variant in ab_variants.items():
            if experiment_name and exp_name != experiment_name:
                continue

            if exp_name not in experiments:
                experiments[exp_name] = {}
            if variant not in experiments[exp_name]:
                experiments[exp_name][variant] = {
                    "sent": 0, "opened": 0, "clicked": 0, "replied": 0,
                }

            stats = experiments[exp_name][variant]
            stats["sent"] += 1
            if email.opened_at:
                stats["opened"] += 1
            if email.clicked_at:
                stats["clicked"] += 1
            if email.replied_at:
                stats["replied"] += 1

    # Calculate rates
    results = {}
    for exp_name, variants in experiments.items():
        results[exp_name] = {}
        for variant, stats in variants.items():
            sent = stats["sent"]
            results[exp_name][variant] = {
                **stats,
                "open_rate": round(stats["opened"] / sent * 100, 1) if sent else 0,
                "click_rate": round(stats["clicked"] / sent * 100, 1) if sent else 0,
                "reply_rate": round(stats["replied"] / sent * 100, 1) if sent else 0,
            }

    return results


async def get_winning_variant(experiment_name: str, metric: str = "reply_rate") -> Optional[str]:
    """
    Determine the winning variant for an experiment based on a metric.

    Returns the variant name with the best performance, or None if insufficient data.
    """
    results = await get_experiment_results(experiment_name)
    exp_data = results.get(experiment_name)
    if not exp_data:
        return None

    # Need at least 10 sends per variant for statistical relevance
    min_sends = 10
    eligible = {v: d for v, d in exp_data.items() if d["sent"] >= min_sends}
    if not eligible:
        return None

    return max(eligible, key=lambda v: eligible[v].get(metric, 0))
