"""
AJ Builds Drone — Outreach Automation API.

FastAPI application for the drone-focused outreach pipeline.
Discovery → Enrichment → Scoring → Lab Audit → Email Sequence → Tracking.

CRITICAL: No email is ever sent without explicit human approval.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.database import init_db, close_db
from api.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("drone.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB, Firebase, seed defaults, start agent scheduler."""
    logger.info("Starting AJ Builds Drone API...")

    # Initialize database
    await init_db()
    logger.info("Database initialized")

    # Initialize Firebase (shared with AjayaDesign)
    if settings.firebase_cred_path:
        from api.services.firebase import init_firebase
        ok = init_firebase(settings.firebase_cred_path, settings.firebase_db_url)
        if ok:
            logger.info("Firebase RTDB bridge active (drone/ namespace)")
    else:
        logger.info("Firebase not configured — RTDB sync disabled")

    # Seed default outreach sequence if none exists
    await _seed_default_sequence()

    # Start agent scheduler
    from api.agents.scheduler import scheduler, register_all_agents
    register_all_agents()
    await scheduler.start()
    logger.info("Agent scheduler started")

    logger.info("AJ Builds Drone API ready")
    yield

    # Shutdown
    await scheduler.stop()
    await close_db()
    logger.info("AJ Builds Drone API shutdown")


async def _seed_default_sequence():
    """Create the default University Professor email sequence."""
    from sqlalchemy import select, func
    from api.database import async_session_factory
    from api.models.prospect import OutreachSequence

    async with async_session_factory() as db:
        count = (await db.execute(select(func.count(OutreachSequence.id)))).scalar()
        if count > 0:
            return

        import uuid
        seq = OutreachSequence(
            id=uuid.uuid4(),
            name="University Professor — Lab Capability Audit v1",
            segment_tag="university",
            steps=[
                {"step": 1, "delay_days": 0, "type": "email", "template": "lab_capability_audit"},
                {"step": 2, "delay_days": 3, "type": "email", "template": "technical_value"},
                {"step": 3, "delay_days": 7, "type": "email", "template": "social_proof"},
                {"step": 4, "delay_days": 21, "type": "email", "template": "breakup"},
                {"step": 5, "delay_days": 90, "type": "email", "template": "resurrection"},
            ],
        )
        db.add(seq)
        await db.commit()
        logger.info("Seeded default outreach sequence: %s", seq.name)


# ── FastAPI App ──

app = FastAPI(
    title="AJ Builds Drone — Outreach API",
    version="1.0.0",
    description="Drone professional outreach automation pipeline",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
from api.routes.drone_outreach import router as outreach_router
from api.routes.contracts import router as contract_router, invoice_router, email_router
from api.routes.activity import activity_router
from api.routes.dashboard import router as dashboard_router

app.include_router(outreach_router)
app.include_router(contract_router)
app.include_router(invoice_router)
app.include_router(email_router)
app.include_router(activity_router)
app.include_router(dashboard_router)


@app.get("/")
async def root():
    return {
        "service": "AJ Builds Drone — Outreach API",
        "version": "4.0.0",
        "endpoints": {
            "prospects": "/outreach/prospects",
            "stats": "/outreach/stats",
            "funnel": "/outreach/funnel",
            "dashboard": "/dashboard",
            "discover_scholar": "/outreach/discover/scholar",
            "discover_nsf": "/outreach/discover/nsf",
            "discover_faculty": "/outreach/discover/faculty",
            "discover_arxiv": "/outreach/discover/arxiv",
            "discover_github": "/outreach/discover/github",
            "discover_sam_gov": "/outreach/discover/sam-gov",
            "discover_dedup": "/outreach/discover/dedup",
            "seed_batch": "/outreach/discover/seed-batch",
            "ab_tests": "/outreach/ab-tests",
            "optimizer": "/outreach/optimizer/engagement",
            "contracts": "/contracts",
            "invoices": "/invoices",
            "activity": "/activity",
            "agents": "/outreach/agents/status",
        },
    }


@app.get("/health")
async def health():
    return {"status": "ok"}