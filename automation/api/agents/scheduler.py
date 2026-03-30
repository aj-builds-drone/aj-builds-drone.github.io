"""
AJ Builds Drone — Multi-agent scheduler.

Runs discovery, enrichment, scoring, and copywriter agents on schedules.
All agents run as asyncio tasks inside the FastAPI lifespan — no external
scheduler needed.

Features:
  - Per-agent pause / resume
  - Global start / stop
  - Self-healing: exponential backoff on errors, auto-recovery after success,
    stuck-agent detection (running > 2× interval → auto-restart)

CRITICAL: The copywriter agent generates email DRAFTS only.
No email is ever sent without explicit human approval.
"""

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Callable, Awaitable

logger = logging.getLogger("drone.agents.scheduler")

MAX_BACKOFF = 1800  # 30 minutes cap
CIRCUIT_BREAKER_THRESHOLD = 10  # Auto-pause after this many consecutive failures
CIRCUIT_BREAKER_RESET_MINUTES = 60  # Auto-resume after this many minutes

# Agent groups for pipeline chaining
DISCOVERY_AGENTS = {
    "scholar_crawler", "nsf_crawler", "faculty_crawler",
    "arxiv_crawler", "github_crawler", "sam_gov_crawler",
}
# Processing agents wake early when new prospects are discovered
PIPELINE_AGENTS = {
    "deduplicator", "enrichment", "batch_scorer", "research_analyzer",
    "lab_auditor", "copywriter", "prospect_enqueue", "email_hunter", "geocoder",
}


class AgentTask:
    """Tracks a single scheduled agent."""

    def __init__(self, name: str, fn: Callable[[], Awaitable[dict]], interval_seconds: int):
        self.name = name
        self.fn = fn
        self.interval = interval_seconds
        self.last_run: datetime | None = None
        self.last_result: dict | None = None
        self.runs: int = 0
        self.errors: int = 0
        self.consecutive_errors: int = 0
        self.status: str = "idle"          # idle | running | paused | error | stopped
        self.paused: bool = False
        self._task: asyncio.Task | None = None
        self._started_at: float | None = None  # monotonic time when current run started
        self._recoveries: int = 0
        self._circuit_broken_at: datetime | None = None  # when circuit breaker tripped

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "interval_seconds": self.interval,
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "last_result": self.last_result,
            "runs": self.runs,
            "errors": self.errors,
            "consecutive_errors": self.consecutive_errors,
            "recoveries": self._recoveries,
            "status": self.status,
            "paused": self.paused,
        }


class AgentScheduler:
    """Manages all background agent tasks with self-healing."""

    def __init__(self):
        self.agents: dict[str, AgentTask] = {}
        self._running = False
        self._started_at: datetime | None = None
        self._health_task: asyncio.Task | None = None
        self._new_data_event = asyncio.Event()  # Set when crawlers find new prospects

    def register(self, name: str, fn: Callable[[], Awaitable[dict]], interval_seconds: int):
        self.agents[name] = AgentTask(name, fn, interval_seconds)
        logger.info(f"Registered agent: {name} (every {interval_seconds}s)")

    # ── Global start / stop ──

    async def start(self):
        self._running = True
        self._started_at = datetime.now(timezone.utc)
        for agent in self.agents.values():
            agent.status = "idle"
            agent._task = asyncio.create_task(self._run_loop(agent))
        # Start health monitor
        self._health_task = asyncio.create_task(self._health_monitor())
        logger.info(f"Agent scheduler started with {len(self.agents)} agents")

    async def stop(self):
        self._running = False
        if self._health_task and not self._health_task.done():
            self._health_task.cancel()
        for agent in self.agents.values():
            if agent._task and not agent._task.done():
                agent._task.cancel()
                try:
                    await agent._task
                except asyncio.CancelledError:
                    pass
            agent.status = "stopped"
        logger.info("Agent scheduler stopped")

    # ── Per-agent pause / resume ──

    def pause_agent(self, name: str) -> dict:
        agent = self.agents.get(name)
        if not agent:
            return {"error": f"Agent '{name}' not found"}
        agent.paused = True
        agent.status = "paused"
        logger.info(f"Agent {name} paused")
        return {"ok": True, "agent": name, "status": "paused"}

    def resume_agent(self, name: str) -> dict:
        agent = self.agents.get(name)
        if not agent:
            return {"error": f"Agent '{name}' not found"}
        agent.paused = False
        agent.status = "idle"
        logger.info(f"Agent {name} resumed")
        return {"ok": True, "agent": name, "status": "idle"}

    async def stop_agent(self, name: str) -> dict:
        agent = self.agents.get(name)
        if not agent:
            return {"error": f"Agent '{name}' not found"}
        if agent._task and not agent._task.done():
            agent._task.cancel()
            try:
                await agent._task
            except asyncio.CancelledError:
                pass
        agent.status = "stopped"
        agent.paused = False
        logger.info(f"Agent {name} stopped")
        return {"ok": True, "agent": name, "status": "stopped"}

    async def start_agent(self, name: str) -> dict:
        agent = self.agents.get(name)
        if not agent:
            return {"error": f"Agent '{name}' not found"}
        # Cancel existing task if any
        if agent._task and not agent._task.done():
            agent._task.cancel()
            try:
                await agent._task
            except asyncio.CancelledError:
                pass
        agent.status = "idle"
        agent.paused = False
        agent.consecutive_errors = 0
        agent._task = asyncio.create_task(self._run_loop(agent))
        logger.info(f"Agent {name} started")
        return {"ok": True, "agent": name, "status": "idle"}

    # ── Run loop with self-healing ──

    async def _run_loop(self, agent: AgentTask):
        # Initial delay to avoid all agents starting at once
        await asyncio.sleep(5 + hash(agent.name) % 30)

        while self._running:
            # Skip if paused — check every 5s
            if agent.paused:
                agent.status = "paused"
                await asyncio.sleep(5)
                continue

            agent.status = "running"
            agent._started_at = time.monotonic()
            try:
                result = await agent.fn()
                agent.last_result = result
                agent.runs += 1
                agent.last_run = datetime.now(timezone.utc)
                elapsed = time.monotonic() - agent._started_at
                # Self-healing: reset consecutive errors on success
                if agent.consecutive_errors > 0:
                    logger.info(f"Agent {agent.name} recovered after {agent.consecutive_errors} consecutive errors")
                    agent._recoveries += 1
                agent.consecutive_errors = 0
                agent.status = "idle"
                agent._started_at = None
                logger.info(f"Agent {agent.name} completed run #{agent.runs}: {result}")
                # Log to activity feed
                await _log_agent_activity(
                    agent.name, "completed",
                    _summarize_result(agent.name, result, elapsed),
                    icon="✅", metadata={"run": agent.runs, "elapsed_s": round(elapsed, 1), "result": _safe_meta(result)},
                )

                # Crawler health monitoring: track consecutive zero-result runs
                if agent.name in DISCOVERY_AGENTS:
                    try:
                        from api.services.crawler_health import check_crawler_health
                        await check_crawler_health(agent.name, result)
                    except Exception as he:
                        logger.warning("Crawler health check failed for %s: %s", agent.name, he)

                # Pipeline chaining: if a discovery agent found new prospects, wake processing agents
                if agent.name in DISCOVERY_AGENTS:
                    new_count = result.get("new", 0) or result.get("prospects_new", 0) or 0
                    if new_count > 0:
                        logger.info(f"🔗 Pipeline trigger: {agent.name} found {new_count} new — waking processing agents")
                        self._new_data_event.set()

            except Exception as e:
                agent.errors += 1
                agent.consecutive_errors += 1
                agent.status = "error"
                elapsed = time.monotonic() - agent._started_at if agent._started_at else 0
                agent._started_at = None
                agent.last_result = {"error": str(e)}
                logger.error(f"Agent {agent.name} failed (streak {agent.consecutive_errors}): {e}")
                # Log error to activity feed
                await _log_agent_activity(
                    agent.name, "error",
                    f"{agent.name} failed (streak {agent.consecutive_errors}): {str(e)[:200]}",
                    icon="❌", metadata={"error": str(e)[:500], "streak": agent.consecutive_errors, "elapsed_s": round(elapsed, 1)},
                )

            # Self-healing: exponential backoff on consecutive errors
            if agent.consecutive_errors > 0:
                # Circuit breaker: if errors exceed threshold, auto-pause
                if agent.consecutive_errors >= CIRCUIT_BREAKER_THRESHOLD and not agent._circuit_broken_at:
                    agent._circuit_broken_at = datetime.now(timezone.utc)
                    agent.paused = True
                    agent.status = "paused"
                    logger.error(
                        f"⚡ Circuit breaker tripped for {agent.name} after "
                        f"{agent.consecutive_errors} consecutive errors — auto-paused. "
                        f"Will auto-resume in {CIRCUIT_BREAKER_RESET_MINUTES}min. "
                        f"Last error: {agent.last_result}"
                    )
                    await _log_agent_activity(
                        agent.name, "circuit_breaker",
                        f"Circuit breaker tripped after {agent.consecutive_errors} errors. "
                        f"Auto-paused for {CIRCUIT_BREAKER_RESET_MINUTES}min.",
                        icon="⚡",
                        metadata={"streak": agent.consecutive_errors, "last_error": str(agent.last_result)[:500]},
                    )
                    continue  # Skip backoff sleep, go to paused check at top of loop

                backoff = min(agent.interval * (2 ** (agent.consecutive_errors - 1)), MAX_BACKOFF)
                logger.info(f"Agent {agent.name} backing off {backoff}s (errors: {agent.consecutive_errors})")
                try:
                    await asyncio.sleep(backoff)
                except asyncio.CancelledError:
                    break
            else:
                # Pipeline agents use interruptible sleep — wake early when new data arrives
                if agent.name in PIPELINE_AGENTS:
                    try:
                        self._new_data_event.clear()
                        await asyncio.wait_for(self._new_data_event.wait(), timeout=agent.interval)
                        logger.info(f"🔗 Agent {agent.name} woken early — new prospects discovered")
                    except asyncio.TimeoutError:
                        pass  # Normal interval elapsed
                    except asyncio.CancelledError:
                        break
                else:
                    try:
                        await asyncio.sleep(agent.interval)
                    except asyncio.CancelledError:
                        break

    # ── Health monitor: detects stuck agents ──

    async def _health_monitor(self):
        """Periodically check for stuck agents, restart them, and auto-resume circuit-broken agents."""
        while self._running:
            await asyncio.sleep(60)  # Check every minute
            now = datetime.now(timezone.utc)
            for agent in self.agents.values():
                # Circuit breaker auto-resume
                if agent._circuit_broken_at and agent.paused:
                    elapsed_min = (now - agent._circuit_broken_at).total_seconds() / 60
                    if elapsed_min >= CIRCUIT_BREAKER_RESET_MINUTES:
                        logger.info(
                            f"⚡ Circuit breaker reset for {agent.name} after "
                            f"{elapsed_min:.0f}min — resuming with reset error count"
                        )
                        agent._circuit_broken_at = None
                        agent.paused = False
                        agent.consecutive_errors = 0  # Reset for fresh start
                        agent.status = "idle"
                        await _log_agent_activity(
                            agent.name, "circuit_breaker_reset",
                            f"Circuit breaker reset after {elapsed_min:.0f}min — agent resumed",
                            icon="🔄",
                        )

                # Stuck agent detection
                if agent.status != "running" or agent._started_at is None:
                    continue
                elapsed = time.monotonic() - agent._started_at
                timeout = max(agent.interval * 2, 600)  # 2× interval or 10 min minimum
                if elapsed > timeout:
                    logger.warning(f"Agent {agent.name} stuck for {elapsed:.0f}s (timeout {timeout}s) — restarting")
                    agent._recoveries += 1
                    agent.errors += 1
                    agent.status = "error"
                    agent.last_result = {"error": f"Stuck for {elapsed:.0f}s — auto-restarted"}
                    agent._started_at = None
                    # Cancel and restart the task
                    if agent._task and not agent._task.done():
                        agent._task.cancel()
                        try:
                            await agent._task
                        except asyncio.CancelledError:
                            pass
                    agent._task = asyncio.create_task(self._run_loop(agent))

    # ── Status ──

    def get_status(self) -> dict:
        uptime = None
        if self._started_at:
            delta = datetime.now(timezone.utc) - self._started_at
            hours, rem = divmod(int(delta.total_seconds()), 3600)
            minutes, secs = divmod(rem, 60)
            uptime = f"{hours}h {minutes}m {secs}s"
        return {
            "running": self._running,
            "uptime": uptime,
            "agents": {name: agent.to_dict() for name, agent in self.agents.items()},
        }

    async def run_agent_now(self, name: str) -> dict:
        """Manually trigger an agent run (for admin dashboard)."""
        agent = self.agents.get(name)
        if not agent:
            return {"error": f"Agent '{name}' not found"}
        if agent.paused:
            return {"error": f"Agent '{name}' is paused — resume first"}
        agent.status = "running"
        agent._started_at = time.monotonic()
        try:
            result = await agent.fn()
            agent.last_result = result
            agent.runs += 1
            agent.last_run = datetime.now(timezone.utc)
            if agent.consecutive_errors > 0:
                agent._recoveries += 1
            agent.consecutive_errors = 0
            agent.status = "idle"
            agent._started_at = None
            return result
        except Exception as e:
            agent.errors += 1
            agent.consecutive_errors += 1
            agent.status = "error"
            agent._started_at = None
            agent.last_result = {"error": str(e)}
            return {"error": str(e)}


# Global scheduler instance
scheduler = AgentScheduler()


# ── Activity logging helpers ──

AGENT_ICONS = {
    "scholar_crawler": "🔬", "nsf_crawler": "🏛️", "faculty_crawler": "🎓",
    "arxiv_crawler": "📄", "batch_scorer": "📊", "deduplicator": "🔗",
    "enrichment": "🔍", "lab_auditor": "🏗️", "copywriter": "✉️",
    "cadence_sender": "📤", "prospect_enqueue": "📥", "github_crawler": "🐙",
    "sam_gov_crawler": "🇺🇸", "email_hunter": "📧", "research_analyzer": "🧠",
    "geocoder": "📍",
}


def _safe_meta(result: dict) -> dict:
    """Trim result dict to safe size for JSONB storage."""
    if not isinstance(result, dict):
        return {}
    safe = {}
    for k, v in result.items():
        if isinstance(v, (str, int, float, bool, type(None))):
            safe[k] = v
        elif isinstance(v, dict):
            safe[k] = str(v)[:200]
        elif isinstance(v, list):
            safe[k] = len(v)
    return safe


def _summarize_result(name: str, result: dict, elapsed: float) -> str:
    """Create a human-readable summary of an agent run."""
    if not isinstance(result, dict):
        return f"{name} completed in {elapsed:.1f}s"
    parts = [name]
    # Pick the most interesting metrics
    for key in ["scored", "drafts_created", "analyzed", "strong", "prospects_found",
                 "prospects_new", "enriched", "deduplicated", "emails_found",
                 "sent", "enqueued", "audited"]:
        if key in result and result[key]:
            parts.append(f"{key}={result[key]}")
    parts.append(f"({elapsed:.1f}s)")
    return " ".join(parts)


async def _log_agent_activity(agent_name: str, action: str, description: str,
                              icon: str = "🤖", metadata: dict = None):
    """Log an agent event to the activity_logs table."""
    try:
        from api.routes.activity import log_activity
        await log_activity(
            entity_type="agent",
            entity_id=agent_name,
            action=action,
            description=description,
            icon=icon or AGENT_ICONS.get(agent_name, "🤖"),
            actor=f"agent:{agent_name}",
            metadata=metadata,
        )
    except Exception as e:
        logger.debug(f"Failed to log agent activity: {e}")


# ── Agent functions ──
# These wrap the crawlers/services and return summary dicts.


async def run_scholar_agent() -> dict:
    """Run Google Scholar discovery crawl."""
    from api.services.scholar_crawler import crawl_scholar
    result = await crawl_scholar()
    return result


async def run_nsf_agent() -> dict:
    """Run NSF Award Search discovery crawl."""
    from api.services.nsf_crawler import crawl_nsf
    result = await crawl_nsf()
    return result


async def run_faculty_agent() -> dict:
    """Run university faculty page scraping."""
    from api.services.faculty_crawler import crawl_faculty_pages
    result = await crawl_faculty_pages()
    return result


async def run_scoring_agent() -> dict:
    """Batch-score all unscored prospects."""
    from api.services.scoring_engine import batch_score_prospects
    count = await batch_score_prospects()
    return {"scored": count}


async def run_arxiv_agent() -> dict:
    """Run arXiv paper discovery crawl."""
    from api.services.arxiv_crawler import discover_arxiv_prospects
    result = await discover_arxiv_prospects()
    return result


async def run_dedup_agent() -> dict:
    """Run cross-source de-duplication on prospects."""
    from api.services.dedup_engine import run_deduplication
    result = await run_deduplication()
    return result


async def run_lab_audit_agent() -> dict:
    """Run Lab Capability Auditor + peer comparison + report generation."""
    from api.agents.audit_agent import execute_audit_cycle
    result = await execute_audit_cycle(batch_size=20)
    return result


async def run_enrichment_agent() -> dict:
    """Enrich discovered prospects with faculty/lab page data."""
    from api.agents.enrichment_agent import execute_enrichment_cycle
    result = await execute_enrichment_cycle(batch_size=20)
    return result


async def run_copywriter_agent() -> dict:
    """Generate email DRAFTS for scored prospects. NEVER auto-sends."""
    from api.services.drone_template_engine import batch_compose_drafts
    count = await batch_compose_drafts(limit=20)
    return {"drafts_created": count}


async def run_cadence_agent() -> dict:
    """Process approved emails in the send queue. Respects limits and windows."""
    from api.services.drone_cadence_engine import process_send_queue
    result = await process_send_queue()
    return result


async def run_enqueue_agent() -> dict:
    """Enqueue scored prospects into the outreach sequence (creates drafts)."""
    from api.services.drone_cadence_engine import batch_enqueue_prospects
    count = await batch_enqueue_prospects(limit=20)
    return {"enqueued": count}


async def run_github_agent() -> dict:
    """Run GitHub contributor discovery crawl."""
    from api.services.github_crawler import crawl_github_contributors
    result = await crawl_github_contributors()
    return result


async def run_sam_gov_agent() -> dict:
    """Run SAM.gov solicitation discovery crawl."""
    from api.services.sam_crawler import crawl_sam_gov
    result = await crawl_sam_gov()
    return result


async def run_email_hunter_agent() -> dict:
    """Run 7-strategy email hunter on prospects missing emails."""
    from api.services.drone_email_hunter import batch_hunt_emails
    result = await batch_hunt_emails(batch_size=30)
    return result


async def run_research_analyzer_agent() -> dict:
    """Analyze prospect papers/research for drone relevance before email drafting."""
    from api.agents.research_analyzer import execute_research_analysis_cycle
    result = await execute_research_analysis_cycle(batch_size=50)
    return result


async def run_geocoder_agent() -> dict:
    """Geocode prospects — populate lat/lng from organization names."""
    from api.agents.geocoder import execute_geocoding_cycle
    result = await execute_geocoding_cycle(batch_size=100)
    return result


async def run_bounce_checker_agent() -> dict:
    """Scan Gmail inbox for bounce notifications and update email statuses."""
    from api.services.bounce_checker import check_bounces
    result = await check_bounces()
    return result


async def run_reply_checker_agent() -> dict:
    """Scan Gmail inbox for replies from prospects we've emailed."""
    from api.services.bounce_checker import check_replies
    result = await check_replies()
    return result


async def run_bounce_recovery_agent() -> dict:
    """Try to find new emails for bounced prospects via their papers."""
    from api.services.bounce_recovery import recover_bounced_prospects
    result = await recover_bounced_prospects(batch_size=10)
    return result


def register_all_agents():
    """Register all discovery and processing agents with the scheduler."""
    # Discovery agents — reduced intervals for continuous growth
    scheduler.register("scholar_crawler", run_scholar_agent, interval_seconds=90 * 60)      # Every 90 min (SerpAPI rate limits)
    scheduler.register("nsf_crawler", run_nsf_agent, interval_seconds=2 * 3600)             # Every 2 hours
    scheduler.register("faculty_crawler", run_faculty_agent, interval_seconds=2 * 3600)     # Every 2 hours
    scheduler.register("arxiv_crawler", run_arxiv_agent, interval_seconds=3 * 3600)         # Every 3 hours

    # Processing agents — run frequently, also wake early via pipeline chaining
    scheduler.register("batch_scorer", run_scoring_agent, interval_seconds=20 * 60)         # Every 20 min
    scheduler.register("deduplicator", run_dedup_agent, interval_seconds=30 * 60)           # Every 30 min

    # Phase 3: Intelligence Engine agents
    scheduler.register("enrichment", run_enrichment_agent, interval_seconds=30 * 60)        # Every 30 min
    scheduler.register("lab_auditor", run_lab_audit_agent, interval_seconds=45 * 60)        # Every 45 min
    scheduler.register("copywriter", run_copywriter_agent, interval_seconds=30 * 60)        # Every 30 min (DRAFTS only, needs research_analyzer first)

    # Phase 4: Outreach Engine agents
    scheduler.register("cadence_sender", run_cadence_agent, interval_seconds=15 * 60)       # Every 15 min — send approved emails
    scheduler.register("prospect_enqueue", run_enqueue_agent, interval_seconds=30 * 60)     # Every 30 min — enqueue new prospects

    # Phase 6: Scale agents
    scheduler.register("github_crawler", run_github_agent, interval_seconds=6 * 3600)       # Every 6 hours — GitHub contributors
    scheduler.register("sam_gov_crawler", run_sam_gov_agent, interval_seconds=4 * 3600)      # Every 4 hours — SAM.gov solicitations

    # Email Hunter — aggressive email discovery for all prospects
    scheduler.register("email_hunter", run_email_hunter_agent, interval_seconds=30 * 60)    # Every 30 min — find missing emails

    # Research Analyzer — scores papers for drone relevance BEFORE copywriter runs
    scheduler.register("research_analyzer", run_research_analyzer_agent, interval_seconds=30 * 60)  # Every 30 min — analyze papers

    # Geocoder — populate lat/lng for map display
    scheduler.register("geocoder", run_geocoder_agent, interval_seconds=2 * 3600)  # Every 2 hours — geocode orgs

    # Bounce checker — scan Gmail for NDRs and mark bounced emails
    scheduler.register("bounce_checker", run_bounce_checker_agent, interval_seconds=5 * 60)  # Every 5 min — detect bounces fast

    # Reply checker — scan Gmail for prospect replies
    scheduler.register("reply_checker", run_reply_checker_agent, interval_seconds=5 * 60)  # Every 5 min — detect replies fast

    # Bounce recovery — re-discover emails for bounced prospects from their papers
    scheduler.register("bounce_recovery", run_bounce_recovery_agent, interval_seconds=30 * 60)  # Every 30 min — recover bounced
