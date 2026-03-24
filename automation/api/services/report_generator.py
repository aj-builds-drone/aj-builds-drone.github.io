"""
Lab Capability Report Generator — produces the HTML report that hooks professors.

Generates an HTML email-friendly Lab Capability Report matching the design
from OUTREACH_STRATEGY.md §3.2. This is the core value proposition:
a free competitive analysis that demonstrates AJ's expertise.

Phase 3 of OUTREACH_STRATEGY.md.
"""

import logging
from datetime import datetime, timezone
from html import escape
from typing import Optional

from api.database import async_session_factory
from api.models.prospect import DroneProspect, LabAudit

logger = logging.getLogger("drone.report_generator")


def _bar(score: int, max_score: int = 100) -> str:
    """Generate an inline HTML progress bar."""
    pct = min(max(score, 0), max_score) / max_score * 100
    if pct >= 70:
        color = "#22c55e"  # green
    elif pct >= 40:
        color = "#f59e0b"  # amber
    else:
        color = "#ef4444"  # red

    return (
        f'<div style="background:#e5e7eb;border-radius:4px;height:12px;width:200px;display:inline-block;vertical-align:middle;">'
        f'<div style="background:{color};border-radius:4px;height:12px;width:{pct:.0f}%;"></div>'
        f'</div>'
        f' <strong>{score}</strong>/100'
    )


def _check(val: bool) -> str:
    return "✓" if val else "✗"


def generate_report_html(prospect: DroneProspect, audit: dict,
                         peer_data: Optional[dict] = None) -> str:
    """
    Generate a Lab Capability Report as inline-styled HTML.

    Args:
        prospect: DroneProspect with populated fields
        audit: Dict from audit_lab_capabilities() or LabAudit.to_dict()
        peer_data: Optional dict from compare_prospect_to_peers()

    Returns:
        HTML string safe for email embedding.
    """
    name = escape(prospect.name or "Professor")
    lab_name = escape(prospect.lab_name or "Research Lab")
    org = escape(prospect.organization or "University")
    dept = escape(prospect.department or "")

    # Scores
    hw_score = audit.get("hardware_score") or 0
    sw_score = audit.get("software_score") or 0
    rs_score = audit.get("research_score") or 0
    overall = audit.get("overall_score") or 0

    # Header
    html = f"""
<div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;color:#1f2937;">

  <!-- Header -->
  <div style="background:#0f172a;color:#f8fafc;padding:24px 28px;border-radius:8px 8px 0 0;">
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;margin-bottom:4px;">Lab Capability Report</div>
    <div style="font-size:20px;font-weight:700;">{name}</div>
    <div style="font-size:14px;color:#cbd5e1;">{lab_name} — {org}{(' • ' + dept) if dept else ''}</div>
    <div style="font-size:12px;color:#64748b;margin-top:8px;">Generated {datetime.now(timezone.utc).strftime('%B %d, %Y')}</div>
  </div>

  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px 28px;border-radius:0 0 8px 8px;">
"""

    # ── Research Profile ──
    papers_3yr = audit.get("papers_last_3yr") or 0
    avg_cites = audit.get("avg_citations") or 0
    h_index = prospect.h_index or "N/A"
    areas = prospect.research_areas or []
    top_venues = audit.get("top_venues", [])
    grants = prospect.active_grants or []

    html += f"""
    <!-- Research Profile -->
    <div style="margin-bottom:24px;">
      <div style="font-size:16px;font-weight:700;color:#0f172a;border-bottom:2px solid #3b82f6;padding-bottom:6px;margin-bottom:12px;">
        📚 Research Profile
      </div>
      <table style="width:100%;font-size:14px;border-collapse:collapse;">
        <tr><td style="padding:4px 0;color:#6b7280;width:200px;">Publications (last 3 years)</td><td style="padding:4px 0;font-weight:600;">{papers_3yr}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">h-index</td><td style="padding:4px 0;font-weight:600;">{h_index}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Avg citations/paper</td><td style="padding:4px 0;font-weight:600;">{avg_cites:.1f}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Primary areas</td><td style="padding:4px 0;">{', '.join(escape(a) for a in areas[:4]) or 'N/A'}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Top venues</td><td style="padding:4px 0;">{', '.join(escape(v) for v in top_venues[:5]) or 'N/A'}</td></tr>
"""

    if grants:
        for grant in grants[:2]:
            if isinstance(grant, dict):
                agency = escape(str(grant.get("agency", "NSF")))
                title = escape(str(grant.get("title", "")))[:60]
                amount = grant.get("amount", "")
                amount_str = f"${amount:,}" if isinstance(amount, (int, float)) else str(amount)
                html += f'        <tr><td style="padding:4px 0;color:#6b7280;">Active Grant</td><td style="padding:4px 0;">{agency}: {title} ({amount_str})</td></tr>\n'

    html += """      </table>
    </div>
"""

    # ── Hardware Capability ──
    platforms = audit.get("flight_platforms", [])
    sensors = audit.get("sensor_suite", [])
    custom_pcb = audit.get("has_custom_pcb", False)
    fpga = audit.get("has_fpga_acceleration", False)
    edge = audit.get("edge_compute")

    platform_names = [p["name"] if isinstance(p, dict) else str(p) for p in platforms]
    sensor_names = [s["name"] if isinstance(s, dict) else str(s) for s in sensors]

    html += f"""
    <!-- Hardware Capability -->
    <div style="margin-bottom:24px;">
      <div style="font-size:16px;font-weight:700;color:#0f172a;border-bottom:2px solid #3b82f6;padding-bottom:6px;margin-bottom:12px;">
        🔧 Hardware Capability
      </div>
      <table style="width:100%;font-size:14px;border-collapse:collapse;">
        <tr><td style="padding:4px 0;color:#6b7280;width:200px;">Flight platforms</td><td style="padding:4px 0;">{', '.join(escape(p) for p in platform_names) or 'Not detected'}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Sensor suite</td><td style="padding:4px 0;">{', '.join(escape(s) for s in sensor_names) or 'Camera only'}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Custom PCB/firmware</td><td style="padding:4px 0;">{_check(custom_pcb)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">FPGA acceleration</td><td style="padding:4px 0;">{_check(fpga)}{(' — ' + escape(audit.get('fpga_details', ''))) if fpga and audit.get('fpga_details') else ''}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Edge compute</td><td style="padding:4px 0;">{escape(edge) if edge else '✗ None detected'}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Score</td><td style="padding:4px 0;">{_bar(hw_score)}</td></tr>
      </table>
    </div>
"""

    # ── Software Stack ──
    ros = audit.get("ros_version") or "Not detected"
    fc_sw = audit.get("flight_controller_sw") or "Not detected"
    sim = audit.get("simulation_env") or "Not detected"
    ci = audit.get("ci_cd_pipeline", False)
    test_fw = audit.get("testing_framework") or "Not detected"

    html += f"""
    <!-- Software Stack -->
    <div style="margin-bottom:24px;">
      <div style="font-size:16px;font-weight:700;color:#0f172a;border-bottom:2px solid #3b82f6;padding-bottom:6px;margin-bottom:12px;">
        💻 Software Stack
      </div>
      <table style="width:100%;font-size:14px;border-collapse:collapse;">
        <tr><td style="padding:4px 0;color:#6b7280;width:200px;">ROS version</td><td style="padding:4px 0;">{escape(ros)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Flight controller</td><td style="padding:4px 0;">{escape(fc_sw)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Simulation</td><td style="padding:4px 0;">{escape(sim)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">CI/CD pipeline</td><td style="padding:4px 0;">{_check(ci)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Testing framework</td><td style="padding:4px 0;">{escape(test_fw)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Score</td><td style="padding:4px 0;">{_bar(sw_score)}</td></tr>
      </table>
    </div>
"""

    # ── Competitive Position ──
    if peer_data and peer_data.get("peer_labs"):
        position = peer_data.get("competitive_position", "developing")
        rank = peer_data.get("competitive_rank", "—")
        gap = escape(peer_data.get("competitive_gap", ""))

        html += """
    <!-- Competitive Position -->
    <div style="margin-bottom:24px;">
      <div style="font-size:16px;font-weight:700;color:#0f172a;border-bottom:2px solid #3b82f6;padding-bottom:6px;margin-bottom:12px;">
        📊 Competitive Position
      </div>
      <table style="width:100%;font-size:14px;border-collapse:collapse;">
"""
        for peer in peer_data["peer_labs"][:3]:
            peer_name = escape(peer.get("name", ""))
            peer_score = peer.get("overall_score", 0)
            html += f'        <tr><td style="padding:4px 0;color:#6b7280;width:200px;">✦ {peer_name}</td><td style="padding:4px 0;">{_bar(peer_score)}</td></tr>\n'

        # Prospect's own score row
        html += f'        <tr style="background:#eff6ff;"><td style="padding:8px 4px;color:#1e40af;font-weight:700;width:200px;">→ {escape(lab_name)}</td><td style="padding:8px 4px;">{_bar(overall)}</td></tr>\n'

        html += f"""      </table>
      <div style="margin-top:8px;font-size:13px;color:#6b7280;">
        <strong>Rank:</strong> #{rank} among peer labs •
        <strong>Position:</strong> {escape(position.title())} •
        <strong>Primary gap:</strong> {gap}
      </div>
    </div>
"""

    # ── Recommendations ──
    recs = audit.get("recommendations", [])
    if recs:
        html += """
    <!-- Recommendations -->
    <div style="margin-bottom:24px;">
      <div style="font-size:16px;font-weight:700;color:#0f172a;border-bottom:2px solid #3b82f6;padding-bottom:6px;margin-bottom:12px;">
        💡 Recommendations
      </div>
"""
        for rec in recs[:4]:
            if isinstance(rec, dict):
                area = escape(rec.get("area", "")).upper()
                priority = rec.get("priority", "medium")
                rec_text = escape(rec.get("recommendation", ""))
                impact = escape(rec.get("impact", ""))
                badge_color = "#ef4444" if priority == "high" else "#f59e0b"
                html += f"""
      <div style="margin-bottom:12px;padding:12px;background:#f8fafc;border-left:3px solid {badge_color};border-radius:0 4px 4px 0;">
        <div style="font-size:11px;text-transform:uppercase;color:{badge_color};font-weight:700;margin-bottom:4px;">{area} — {escape(priority)} priority</div>
        <div style="font-size:14px;color:#1f2937;">{rec_text}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px;">Impact: {impact}</div>
      </div>
"""
        html += "    </div>\n"

    # ── Footer ──
    html += """
    <!-- Footer -->
    <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:8px;font-size:13px;color:#6b7280;">
      <div style="margin-bottom:8px;">
        Generated by <strong>AJ Builds Drone</strong> — automated lab capability analysis
      </div>
      <div>
        <strong>AJ</strong> — FAA Part 107 Certified | Sr. FPGA Engineer | Austin, TX<br>
        KiCad PCB → PX4 Firmware → ROS2 → Gazebo Simulation<br>
        <a href="https://ajbuildsdrone.com" style="color:#3b82f6;text-decoration:none;">ajbuildsdrone.com</a>
      </div>
    </div>

  </div>
</div>
"""

    return html


async def generate_and_store_report(prospect_id: str,
                                    audit_data: Optional[dict] = None,
                                    peer_data: Optional[dict] = None) -> Optional[str]:
    """
    Generate a Lab Capability Report and store it in the LabAudit record.

    Args:
        prospect_id: UUID of the prospect
        audit_data: Optional dict (if not provided, fetches from latest LabAudit)
        peer_data: Optional peer comparison data

    Returns:
        HTML string of the generated report, or None if prospect not found.
    """
    from sqlalchemy.orm import selectinload

    async with async_session_factory() as db:
        prospect = await db.get(
            DroneProspect, prospect_id,
            options=[selectinload(DroneProspect.audits)],
        )
        if not prospect:
            logger.warning("Prospect %s not found for report generation", prospect_id)
            return None

        # Get audit data from latest audit if not provided
        if not audit_data and prospect.audits:
            latest = sorted(prospect.audits, key=lambda a: a.audited_at or a.id, reverse=True)[0]
            audit_data = latest.to_dict()

        if not audit_data:
            logger.warning("No audit data for prospect %s — cannot generate report", prospect_id)
            return None

        # Generate HTML
        html = generate_report_html(prospect, audit_data, peer_data)

        # Store in latest LabAudit
        if prospect.audits:
            latest = sorted(prospect.audits, key=lambda a: a.audited_at or a.id, reverse=True)[0]
            latest.report_html = html
            await db.commit()

        logger.info("Generated Lab Capability Report for %s (%d chars)", prospect.name, len(html))
        return html
