"""
Drone Outreach Agent — SQLAlchemy models for drone prospects, lab audits, emails, and sequences.

These are the core data models for the drone-focused outreach pipeline targeting
university professors, research labs, drone operators, and defense contractors.
PostgreSQL is the source of truth.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import relationship

from api.database import Base


def _utcnow():
    return datetime.now(timezone.utc)


class DiscoveryBatch(Base):
    """A discovery batch — tracks a single crawl run across one source."""

    __tablename__ = "discovery_batches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source = Column(String, nullable=False)
    query = Column(Text)
    status = Column(String, default="pending")
    prospects_found = Column(Integer, default=0)
    prospects_new = Column(Integer, default=0)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    def to_dict(self):
        return {
            "id": str(self.id),
            "source": self.source,
            "query": self.query,
            "status": self.status,
            "prospects_found": self.prospects_found,
            "prospects_new": self.prospects_new,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class DroneProspect(Base):
    """A discovered drone prospect — professor, lab, operator, or contractor."""

    __tablename__ = "drone_prospects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── Identity ──
    name = Column(String, nullable=False)
    title = Column(String)
    department = Column(String)
    organization = Column(String, nullable=False)
    organization_type = Column(String, default="university")

    # ── Contact ──
    email = Column(String, index=True)
    phone = Column(String)
    linkedin_url = Column(Text)
    scholar_url = Column(Text)
    personal_site = Column(Text)
    lab_url = Column(Text)

    # ── Location ──
    city = Column(String)
    state = Column(String)
    country = Column(String, default="US")
    lat = Column(Numeric(10, 7))
    lng = Column(Numeric(10, 7))

    # ── Research Profile ──
    research_areas = Column(ARRAY(String))
    recent_papers = Column(JSONB)
    h_index = Column(Integer)
    total_citations = Column(Integer)
    publication_rate = Column(Numeric(4, 1))
    lab_name = Column(String)
    lab_students_count = Column(Integer)
    lab_description = Column(Text)

    # ── Grant / Funding ──
    active_grants = Column(JSONB)
    total_grant_funding = Column(Integer)
    grant_agencies = Column(ARRAY(String))

    # ── Drone Capability Assessment ──
    has_drone_lab = Column(Boolean, default=False)
    flight_testing_capability = Column(Boolean, default=False)
    simulation_setup = Column(String)
    hardware_platforms = Column(ARRAY(String))
    has_custom_hardware = Column(Boolean, default=False)
    has_fpga = Column(Boolean, default=False)
    software_stack = Column(ARRAY(String))
    sensor_types = Column(ARRAY(String))
    flight_controller = Column(String)
    flight_controller_version = Column(String)

    # ── Capability Scores (from lab audit) ──
    score_hardware = Column(Integer)
    score_software = Column(Integer)
    score_research = Column(Integer)
    score_overall = Column(Integer)

    # ── Competitive Analysis ──
    peer_labs = Column(JSONB)
    primary_gap = Column(Text)
    competitive_position = Column(String)

    # ── Scoring (outreach priority) ──
    need_score = Column(Integer)
    ability_score = Column(Integer)
    timing_score = Column(Integer)
    priority_score = Column(Integer, index=True)
    score_json = Column(JSONB)
    tier = Column(String)

    # ── Outreach State ──
    status = Column(String, default="discovered", index=True)
    emails_sent = Column(Integer, default=0)
    emails_opened = Column(Integer, default=0)
    emails_clicked = Column(Integer, default=0)
    last_email_at = Column(DateTime(timezone=True))
    last_opened_at = Column(DateTime(timezone=True))
    replied_at = Column(DateTime(timezone=True))
    reply_sentiment = Column(String)
    meeting_scheduled_at = Column(DateTime(timezone=True))
    converted_at = Column(DateTime(timezone=True))

    # ── Discovery Meta ──
    source = Column(String)
    source_url = Column(Text)
    discovery_batch_id = Column(UUID(as_uuid=True))
    notes = Column(Text)
    tags = Column(ARRAY(String))

    # ── Enrichment ──
    enrichment = Column(JSONB)
    enriched_at = Column(DateTime(timezone=True))
    audited_at = Column(DateTime(timezone=True))

    # ── Part 107 / Certifications ──
    faa_part107 = Column(Boolean)
    certifications = Column(ARRAY(String))

    # ── Timestamps ──
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    # ── Relationships ──
    audits = relationship("LabAudit", back_populates="prospect", lazy="raise")
    emails = relationship("OutreachEmail", back_populates="prospect", lazy="raise")
    activities = relationship("ProspectActivity", back_populates="prospect", lazy="raise")

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "title": self.title,
            "department": self.department,
            "organization": self.organization,
            "organization_type": self.organization_type,
            "email": self.email,
            "phone": self.phone,
            "linkedin_url": self.linkedin_url,
            "scholar_url": self.scholar_url,
            "personal_site": self.personal_site,
            "lab_url": self.lab_url,
            "city": self.city,
            "state": self.state,
            "country": self.country,
            "lat": float(self.lat) if self.lat else None,
            "lng": float(self.lng) if self.lng else None,
            "research_areas": self.research_areas or [],
            "recent_papers": self.recent_papers or [],
            "h_index": self.h_index,
            "total_citations": self.total_citations,
            "publication_rate": float(self.publication_rate) if self.publication_rate else None,
            "lab_name": self.lab_name,
            "lab_students_count": self.lab_students_count,
            "lab_description": self.lab_description,
            "active_grants": self.active_grants or [],
            "total_grant_funding": self.total_grant_funding,
            "grant_agencies": self.grant_agencies or [],
            "has_drone_lab": self.has_drone_lab,
            "flight_testing_capability": self.flight_testing_capability,
            "simulation_setup": self.simulation_setup,
            "hardware_platforms": self.hardware_platforms or [],
            "has_custom_hardware": self.has_custom_hardware,
            "has_fpga": self.has_fpga,
            "software_stack": self.software_stack or [],
            "sensor_types": self.sensor_types or [],
            "flight_controller": self.flight_controller,
            "flight_controller_version": self.flight_controller_version,
            "score_hardware": self.score_hardware,
            "score_software": self.score_software,
            "score_research": self.score_research,
            "score_overall": self.score_overall,
            "peer_labs": self.peer_labs or [],
            "primary_gap": self.primary_gap,
            "competitive_position": self.competitive_position,
            "need_score": self.need_score,
            "ability_score": self.ability_score,
            "timing_score": self.timing_score,
            "priority_score": self.priority_score,
            "tier": self.tier,
            "status": self.status,
            "emails_sent": self.emails_sent,
            "emails_opened": self.emails_opened,
            "emails_clicked": self.emails_clicked,
            "last_email_at": self.last_email_at.isoformat() if self.last_email_at else None,
            "last_opened_at": self.last_opened_at.isoformat() if self.last_opened_at else None,
            "replied_at": self.replied_at.isoformat() if self.replied_at else None,
            "reply_sentiment": self.reply_sentiment,
            "meeting_scheduled_at": self.meeting_scheduled_at.isoformat() if self.meeting_scheduled_at else None,
            "converted_at": self.converted_at.isoformat() if self.converted_at else None,
            "source": self.source,
            "source_url": self.source_url,
            "notes": self.notes,
            "tags": self.tags or [],
            "enrichment": self.enrichment,
            "enriched_at": self.enriched_at.isoformat() if self.enriched_at else None,
            "audited_at": self.audited_at.isoformat() if self.audited_at else None,
            "faa_part107": self.faa_part107,
            "certifications": self.certifications or [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def to_list_item(self):
        """Minimal dict for table/list views."""
        return {
            "id": str(self.id),
            "name": self.name,
            "title": self.title,
            "organization": self.organization,
            "department": self.department,
            "email": self.email,
            "lab_name": self.lab_name,
            "h_index": self.h_index,
            "priority_score": self.priority_score,
            "tier": self.tier,
            "status": self.status,
            "source": self.source,
        }


class LabAudit(Base):
    """Lab Capability Audit — the drone equivalent of a website audit."""

    __tablename__ = "lab_audits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prospect_id = Column(UUID(as_uuid=True), ForeignKey("drone_prospects.id", ondelete="CASCADE"), nullable=False)

    # ── Hardware Assessment ──
    flight_platforms = Column(JSONB)
    sensor_suite = Column(JSONB)
    has_custom_pcb = Column(Boolean, default=False)
    has_custom_firmware = Column(Boolean, default=False)
    has_fpga_acceleration = Column(Boolean, default=False)
    fpga_details = Column(Text)
    edge_compute = Column(String)
    hardware_score = Column(Integer)

    # ── Software Assessment ──
    ros_version = Column(String)
    flight_controller_sw = Column(String)
    simulation_env = Column(String)
    ci_cd_pipeline = Column(Boolean, default=False)
    testing_framework = Column(String)
    software_score = Column(Integer)

    # ── Research Output Assessment ──
    papers_last_3yr = Column(Integer)
    avg_citations = Column(Numeric(6, 1))
    top_venues = Column(ARRAY(String))
    research_score = Column(Integer)

    # ── Competitive Comparison ──
    peer_comparison = Column(JSONB)
    competitive_gap = Column(Text)
    competitive_rank = Column(Integer)

    # ── Overall ──
    overall_score = Column(Integer)
    recommendations = Column(JSONB)
    report_html = Column(Text)

    audited_at = Column(DateTime(timezone=True), default=_utcnow)

    prospect = relationship("DroneProspect", back_populates="audits")

    def to_dict(self):
        return {
            "id": str(self.id),
            "prospect_id": str(self.prospect_id),
            "flight_platforms": self.flight_platforms or [],
            "sensor_suite": self.sensor_suite or [],
            "has_custom_pcb": self.has_custom_pcb,
            "has_custom_firmware": self.has_custom_firmware,
            "has_fpga_acceleration": self.has_fpga_acceleration,
            "fpga_details": self.fpga_details,
            "edge_compute": self.edge_compute,
            "hardware_score": self.hardware_score,
            "ros_version": self.ros_version,
            "flight_controller_sw": self.flight_controller_sw,
            "simulation_env": self.simulation_env,
            "ci_cd_pipeline": self.ci_cd_pipeline,
            "testing_framework": self.testing_framework,
            "software_score": self.software_score,
            "papers_last_3yr": self.papers_last_3yr,
            "avg_citations": float(self.avg_citations) if self.avg_citations else None,
            "top_venues": self.top_venues or [],
            "research_score": self.research_score,
            "peer_comparison": self.peer_comparison or [],
            "competitive_gap": self.competitive_gap,
            "competitive_rank": self.competitive_rank,
            "overall_score": self.overall_score,
            "recommendations": self.recommendations or [],
            "audited_at": self.audited_at.isoformat() if self.audited_at else None,
        }


class OutreachEmail(Base):
    __tablename__ = "outreach_emails"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prospect_id = Column(UUID(as_uuid=True), ForeignKey("drone_prospects.id", ondelete="CASCADE"), nullable=False)
    sequence_step = Column(Integer, default=1)
    subject = Column(Text, nullable=False)
    body_html = Column(Text, nullable=False)
    body_text = Column(Text, nullable=False)
    personalization = Column(JSONB)
    template_id = Column(String)
    sent_at = Column(DateTime(timezone=True))
    message_id = Column(String)
    tracking_id = Column(String, unique=True, index=True)
    opened_at = Column(DateTime(timezone=True))
    open_count = Column(Integer, default=0)
    clicked_at = Column(DateTime(timezone=True))
    click_count = Column(Integer, default=0)
    clicked_links = Column(JSONB)
    replied_at = Column(DateTime(timezone=True))
    reply_body = Column(Text)
    reply_sentiment = Column(String)
    status = Column(String, default="draft", index=True)
    scheduled_for = Column(DateTime(timezone=True))
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    prospect = relationship("DroneProspect", back_populates="emails")

    def to_dict(self):
        return {
            "id": str(self.id),
            "prospect_id": str(self.prospect_id),
            "sequence_step": self.sequence_step,
            "subject": self.subject,
            "body_html": self.body_html,
            "body_text": self.body_text,
            "template_id": self.template_id,
            "personalization": self.personalization,
            "status": self.status,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "opened_at": self.opened_at.isoformat() if self.opened_at else None,
            "open_count": self.open_count,
            "clicked_at": self.clicked_at.isoformat() if self.clicked_at else None,
            "click_count": self.click_count,
            "replied_at": self.replied_at.isoformat() if self.replied_at else None,
            "reply_sentiment": self.reply_sentiment,
            "scheduled_for": self.scheduled_for.isoformat() if self.scheduled_for else None,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ProspectActivity(Base):
    __tablename__ = "prospect_activities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prospect_id = Column(UUID(as_uuid=True), ForeignKey("drone_prospects.id", ondelete="CASCADE"), nullable=False)
    activity_type = Column(String, nullable=False, default="note")
    outcome = Column(String)
    notes = Column(Text)
    duration_minutes = Column(Integer)
    contact_name = Column(String)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    prospect = relationship("DroneProspect", back_populates="activities")

    def to_dict(self):
        return {
            "id": str(self.id),
            "prospect_id": str(self.prospect_id),
            "activity_type": self.activity_type,
            "outcome": self.outcome,
            "notes": self.notes,
            "duration_minutes": self.duration_minutes,
            "contact_name": self.contact_name,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class OutreachSequence(Base):
    __tablename__ = "outreach_sequences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    segment_tag = Column(String)
    steps = Column(JSONB, nullable=False)
    total_enrolled = Column(Integer, default=0)
    total_replied = Column(Integer, default=0)
    total_meetings = Column(Integer, default=0)
    reply_rate = Column(Numeric(5, 2))
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "segment_tag": self.segment_tag,
            "steps": self.steps,
            "total_enrolled": self.total_enrolled,
            "total_replied": self.total_replied,
            "total_meetings": self.total_meetings,
            "reply_rate": float(self.reply_rate) if self.reply_rate else None,
            "active": self.active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
