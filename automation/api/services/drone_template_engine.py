"""
Drone Template Engine — Jinja2-powered email composition for drone outreach.

Composes personalized outreach emails for drone prospects using lab audit data,
peer comparisons, and publication profiles. 5-step academic outreach sequence.

Phase 3 of OUTREACH_STRATEGY.md (§3.4).
CRITICAL: All composed emails start as status=draft. No auto-send.
"""

import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape

from api.database import async_session_factory
from api.models.prospect import DroneProspect, LabAudit, OutreachEmail

logger = logging.getLogger("drone.template_engine")

# ─── Template directory ────────────────────────────────────────────────
TEMPLATE_DIR = Path(__file__).parent.parent / "templates" / "email"


def _get_jinja_env() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(TEMPLATE_DIR)),
        autoescape=select_autoescape(["html"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )


# ─── Sequence configuration ───────────────────────────────────────────

DRONE_SEQUENCE = {
    1: {
        "template": "lab_capability_audit.html",
        "subject": "Quick analysis of {{ lab_name }}'s drone capabilities",
        "delay_days": 0,
    },
    2: {
        "template": "technical_value.html",
        "subject": "Re: {{ lab_name }} drone capabilities — FPGA acceleration idea",
        "delay_days": 3,
    },
    3: {
        "template": "social_proof.html",
        "subject": "How {{ peer_org }} upgraded their drone lab",
        "delay_days": 7,
    },
    4: {
        "template": "breakup.html",
        "subject": "Closing the loop on {{ lab_name }} drone analysis",
        "delay_days": 21,
    },
    5: {
        "template": "resurrection.html",
        "subject": "{{ lab_name }} — updated capability analysis",
        "delay_days": 90,
    },
}


def _simple_render(template_str: str, variables: dict) -> str:
    """Simple {{ variable }} replacement for subject lines."""
    result = template_str
    for key, val in variables.items():
        result = result.replace("{{ " + key + " }}", str(val) if val is not None else "")
        result = result.replace("{{" + key + "}}", str(val) if val is not None else "")
    return result


# Words that indicate a non-person / generic contact
_NON_PERSON_WORDS = {
    "people", "results", "contact", "office", "admin", "info",
    "department", "team", "group", "general", "support", "help",
    "manager", "news", "links", "staff", "faculty", "services",
    "communications", "relations", "marketing", "webmaster",
}


def _is_person_name(name: str) -> bool:
    """Return True if the name looks like a real person, not a department/generic contact."""
    if not name or len(name.split()) < 2:
        return False
    words = {w.lower() for w in name.split()}
    return not words & _NON_PERSON_WORDS


def _build_drone_variables(prospect: DroneProspect,
                           audit: Optional[LabAudit] = None) -> dict:
    """
    Build template variable map from prospect + audit data.

    Uses research_analysis from the Research Analyzer Agent to select the most
    relevant paper and technique — instead of blindly grabbing papers[0].
    """
    name = prospect.name or ""
    parts = name.split()

    last_name = parts[-1] if len(parts) >= 2 else name
    first_name = parts[0] if parts else name

    # Build greeting — only use "Dr. Surname" for real person names
    if _is_person_name(name):
        greeting = f"Dr. {last_name}"
    else:
        org = prospect.organization or "there"
        greeting = f"{org} Research Team"

    lab_name = prospect.lab_name or f"{prospect.organization} Lab"
    org = prospect.organization or "University"

    papers = prospect.recent_papers or []
    areas = prospect.research_areas or []

    # ── Pull research analysis from enrichment ──────────────────────────
    enrichment = prospect.enrichment or {}
    analysis = enrichment.get("research_analysis", {})
    hook = analysis.get("hook", {})
    hook_quality = hook.get("quality", "none")

    # Paper: use analyzed best paper (drone-relevant), NOT papers[0]
    if hook.get("paper_title"):
        paper_title = hook["paper_title"]
    elif papers:
        # Fallback: first paper, but flag it
        p = papers[0]
        paper_title = p.get("title", str(p)) if isinstance(p, dict) else str(p)
    else:
        paper_title = "recent drone research"

    # Technique: use analyzed relevant technique, NOT areas[0]
    if hook.get("technique_to_mention"):
        specific_technique = hook["technique_to_mention"]
    elif analysis.get("relevant_areas"):
        specific_technique = analysis["relevant_areas"][0]
    elif areas:
        specific_technique = areas[0]
    else:
        specific_technique = "autonomous systems"

    # Genuine interest statement (the hook for the email opening)
    genuine_interest = hook.get("genuine_interest", "")

    # AJ capability connection
    aj_connection = hook.get("connection_to_aj",
                             "technical collaboration on drone research")

    # Peer data — use prospect.peer_labs first, fall back to audit.peer_comparison
    peer_labs = prospect.peer_labs or []
    if not peer_labs and audit and hasattr(audit, 'peer_comparison') and audit.peer_comparison:
        peer_labs = audit.peer_comparison if isinstance(audit.peer_comparison, list) else []
    peer_1 = peer_labs[0] if len(peer_labs) > 0 else {}
    peer_2 = peer_labs[1] if len(peer_labs) > 1 else {}

    # Lab score — don't use absurdly low audit scores (likely data quality issue)
    raw_score = prospect.score_overall or (audit.overall_score if audit else 0) or 0
    lab_score = raw_score if raw_score >= 10 else 50  # floor at 10; use 50 default

    # Gap / opportunity — use analyzed capability match if available
    capability_match = hook.get("capability_match", "")
    if capability_match == "fpga_design":
        primary_gap = "FPGA-accelerated edge processing"
    elif capability_match == "flight_controller":
        primary_gap = "Custom flight controller integration"
    elif capability_match == "simulation":
        primary_gap = "Reproducible simulation and testing infrastructure"
    elif capability_match == "perception":
        primary_gap = "Low-latency onboard perception pipeline"
    elif capability_match == "platform_design":
        primary_gap = "Custom drone platform design"
    else:
        primary_gap = prospect.primary_gap or "Custom hardware & FPGA acceleration"

    specific_opportunity = _infer_opportunity(prospect, audit)

    # Hardware
    hw_platforms = prospect.hardware_platforms or []
    current_hw = hw_platforms[0] if hw_platforms else "CPU-based processing"
    current_platform = hw_platforms[0] if hw_platforms else "standard platform"

    # Peer for social proof
    peer_org = peer_1.get("organization", "a peer research lab") if peer_1 else "a peer research lab"

    # Research area — use analyzed relevant area
    current_research_area = specific_technique

    # Tracking (placeholder — real tracking IDs set at send time)
    tracking_url = "https://aj-builds-drone.github.io/"
    open_tracker_url = "https://aj-builds-drone.github.io/t/open/placeholder.gif"

    variables = {
        "greeting": greeting,
        "last_name": last_name,
        "first_name": first_name,
        "name": name,
        "lab_name": lab_name,
        "organization": org,
        "department": prospect.department or "",
        "paper_title": paper_title,
        "specific_technique": specific_technique,
        "genuine_interest": genuine_interest,
        "aj_connection": aj_connection,
        "hook_quality": hook_quality,
        "lab_score": lab_score,
        "peer_1_name": peer_1.get("name", "") if peer_1 else "",
        "peer_1_score": peer_1.get("overall_score", "") if peer_1 else "",
        "peer_2_name": peer_2.get("name", "") if peer_2 else "",
        "peer_2_score": peer_2.get("overall_score", "") if peer_2 else "",
        "primary_gap": primary_gap,
        "specific_opportunity": specific_opportunity,
        "recent_paper_topic": specific_technique,
        "current_hw": current_hw,
        "current_platform": current_platform,
        "current_latency": "50",
        "current_power": "15",
        "current_weight": "150",
        "their_algorithm": specific_technique,
        "peer_org": peer_org,
        "peer_university": peer_org,
        "peer_lab": peer_1.get("name", "") if peer_1 else "",
        "their_strength": specific_technique,
        "specific_contribution": aj_connection,
        "current_research_area": current_research_area,
        "new_score": lab_score,
        "old_score": max(lab_score - 5, 0),
        "peer_1_new_score": peer_1.get("overall_score", "") if peer_1 else "",
        "score_change_commentary": _score_change_commentary(lab_score),
        "tracking_url": tracking_url,
        "open_tracker_url": open_tracker_url,
        "h_index": prospect.h_index or "N/A",
        "papers_count": len(papers),
        "total_citations": prospect.total_citations or 0,
    }

    return variables


def _infer_opportunity(prospect: DroneProspect,
                       audit: Optional[LabAudit]) -> str:
    """Infer what specific technical opportunity to propose."""
    if prospect.has_fpga is False or prospect.has_fpga is None:
        return "FPGA-accelerated edge perception for your platform"
    if prospect.simulation_setup in (None, "None", "Unknown", ""):
        return "setting up a Gazebo SITL pipeline for your research"
    if not prospect.has_custom_hardware:
        return "a custom PX4 platform tailored to your research needs"
    return "technical collaboration on your drone research program"


def _score_change_commentary(score: int) -> str:
    """Generate commentary for resurrection emails."""
    if score >= 70:
        return "Your lab's capabilities are strong — a few hardware upgrades could push you into the top tier."
    if score >= 50:
        return "There's been some improvement, but the hardware gap remains. Custom platforms could close it."
    return "The competitive landscape is shifting — several peer labs have upgraded their hardware this year."


async def compose_drone_email(
    prospect_id: str,
    sequence_step: int = 1,
) -> Optional[dict]:
    """
    Compose a personalized drone outreach email.

    Returns dict with subject, body_html, body_text, variables, template_id.
    Does NOT persist — caller decides whether to create an OutreachEmail draft.
    """
    from sqlalchemy.orm import selectinload

    async with async_session_factory() as db:
        prospect = await db.get(
            DroneProspect, prospect_id,
            options=[selectinload(DroneProspect.audits)],
        )
        if not prospect:
            logger.warning("compose_drone_email: prospect %s not found", prospect_id)
            return None

        # Get latest audit
        audit = None
        if prospect.audits:
            audit = sorted(prospect.audits, key=lambda a: a.audited_at or a.id, reverse=True)[0]

        step_config = DRONE_SEQUENCE.get(sequence_step)
        if not step_config:
            logger.warning("No template for sequence step %d", sequence_step)
            return None

        variables = _build_drone_variables(prospect, audit)
        subject = _simple_render(step_config["subject"], variables)

        # Render HTML body
        try:
            env = _get_jinja_env()
            template = env.get_template(step_config["template"])
            body_html = template.render(**variables)
        except Exception as e:
            logger.error("Template render error for %s step %d: %s",
                         prospect.name, sequence_step, e)
            return None

        # Plain text version
        body_text = re.sub(r"<style[^>]*>.*?</style>", "", body_html, flags=re.DOTALL)
        body_text = re.sub(r"<[^>]+>", "", body_text)
        body_text = re.sub(r"\n\s*\n", "\n\n", body_text).strip()

        return {
            "subject": subject,
            "body_html": body_html,
            "body_text": body_text,
            "variables": variables,
            "template_id": step_config["template"],
            "sequence_step": sequence_step,
            "delay_days": step_config["delay_days"],
        }


async def create_email_draft(
    prospect_id: str,
    sequence_step: int = 1,
    skip_quality_gate: bool = False,
) -> Optional[dict]:
    """
    Compose an email and persist it as a DRAFT OutreachEmail.

    CRITICAL: Status is always 'draft'. Never auto-sends.
    Human must review and approve in the admin dashboard.

    Quality gate: Requires research_analysis with hook quality >= 'weak'.
    This prevents nonsensical emails like referencing sleep-scoring papers
    in drone outreach. Set skip_quality_gate=True for manual requests.
    """
    if not skip_quality_gate:
        # Check research analysis exists and has decent hook
        async with async_session_factory() as db:
            prospect = await db.get(DroneProspect, prospect_id)
            if prospect:
                enrichment = prospect.enrichment or {}
                analysis = enrichment.get("research_analysis", {})
                hook = analysis.get("hook", {})
                quality = hook.get("quality", "none")
                if quality == "none":
                    logger.info(
                        "Quality gate: skipping %s — no drone-relevant hook found "
                        "(run research_analyzer first)",
                        prospect.name or prospect_id,
                    )
                    return None

    composed = await compose_drone_email(prospect_id, sequence_step)
    if not composed:
        return None

    # ── Duplicate guard: don't create if an email already exists at this step ──
    async with async_session_factory() as db:
        existing = await db.execute(
            select(OutreachEmail.id).where(
                OutreachEmail.prospect_id == prospect_id,
                OutreachEmail.sequence_step == sequence_step,
                OutreachEmail.status.in_(("draft", "approved", "scheduled", "sent")),
            ).limit(1)
        )
        if existing.first():
            logger.info(
                "Skipping draft for %s step %d — email already exists",
                prospect_id, sequence_step,
            )
            return None

    async with async_session_factory() as db:
        email = OutreachEmail(
            prospect_id=prospect_id,
            sequence_step=composed["sequence_step"],
            subject=composed["subject"],
            body_html=composed["body_html"],
            body_text=composed["body_text"],
            personalization=composed["variables"],
            template_id=composed["template_id"],
            status="draft",  # NEVER auto-send
        )
        db.add(email)
        await db.commit()
        logger.info(
            "Created draft email for prospect %s (step %d, hook=%s): %s",
            prospect_id, sequence_step,
            composed["variables"].get("hook_quality", "?"),
            composed["subject"],
        )
        return email.to_dict()


async def batch_compose_drafts(limit: int = 50) -> int:
    """
    Compose step-1 email drafts for all prospects that have been research-analyzed
    and haven't been emailed yet.

    Pipeline: research_analyzer → quality gate → draft composition → human review
    No tier restriction — if research_analyzer found a drone-relevant hook,
    the prospect gets a draft regardless of hot/warm/cold tier.
    """
    from sqlalchemy import select

    async with async_session_factory() as db:
        # Get prospects that have email, haven't been sent to, and have research analysis
        result = await db.execute(
            select(DroneProspect.id, DroneProspect.enrichment).where(
                DroneProspect.email.isnot(None),
                DroneProspect.emails_sent == 0,
                DroneProspect.status.notin_(("dead", "do_not_contact", "replied", "converted")),
            ).order_by(DroneProspect.priority_score.desc()).limit(limit * 2)
        )
        rows = result.fetchall()

        # Exclude prospects that already have any step-1 email
        if rows:
            ids_with_email = set()
            existing = await db.execute(
                select(OutreachEmail.prospect_id).where(
                    OutreachEmail.sequence_step == 1,
                    OutreachEmail.status.in_(("draft", "approved", "scheduled", "sent")),
                ).distinct()
            )
            for r in existing.fetchall():
                ids_with_email.add(r[0])
            rows = [r for r in rows if str(r[0]) not in ids_with_email]

    # Filter to prospects that have research_analysis with a usable hook
    eligible_ids = []
    for row in rows:
        enrichment = row[1] or {}
        analysis = enrichment.get("research_analysis", {})
        hook = analysis.get("hook", {})
        quality = hook.get("quality", "none")
        if quality in ("strong", "good", "weak"):
            eligible_ids.append(str(row[0]))
        if len(eligible_ids) >= limit:
            break

    count = 0
    for pid in eligible_ids:
        # skip_quality_gate=True because we already checked above
        draft = await create_email_draft(pid, sequence_step=1, skip_quality_gate=True)
        if draft:
            count += 1
    logger.info("Batch composed %d/%d email drafts (from %d eligible)", count, len(eligible_ids), len(rows))
    return count
