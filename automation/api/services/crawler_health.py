"""
Crawler Health Monitor — Alerts when crawlers return 0 results consecutively.

Tracks consecutive zero-result runs per crawler in a JSON file.
Sends a one-time Telegram alert when threshold is reached.
Resets on successful crawl (new > 0).
"""

import json
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger("drone.crawler_health")

# Persistent state file
STATE_FILE = Path("/app/data/crawler_health.json")
ALERT_THRESHOLD = 3  # consecutive zero-result runs before alerting

# Crawler names we monitor
MONITORED_CRAWLERS = {
    "scholar_crawler", "nsf_crawler", "faculty_crawler",
    "arxiv_crawler", "github_crawler",
}


def _load_state() -> dict:
    """Load health state from JSON file."""
    try:
        if STATE_FILE.exists():
            return json.loads(STATE_FILE.read_text())
    except Exception as e:
        logger.warning("Failed to load crawler health state: %s", e)
    return {}


def _save_state(state: dict):
    """Persist health state to JSON file."""
    try:
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        STATE_FILE.write_text(json.dumps(state, indent=2))
    except Exception as e:
        logger.error("Failed to save crawler health state: %s", e)


async def check_crawler_health(crawler_name: str, result: Optional[dict]) -> None:
    """
    Call after each crawler run. Checks result count and alerts if needed.

    Args:
        crawler_name: e.g. "scholar_crawler"
        result: the dict returned by the crawler function
    """
    if crawler_name not in MONITORED_CRAWLERS:
        return

    # Extract new-result count from the various return formats
    new_count = 0
    if isinstance(result, dict):
        new_count = result.get("new", 0) or result.get("prospects_new", 0) or 0

    state = _load_state()
    entry = state.get(crawler_name, {"consecutive_zeros": 0, "alerted": False})

    if new_count > 0:
        # Reset on success
        if entry.get("consecutive_zeros", 0) > 0:
            logger.info("Crawler %s recovered — found %d new results", crawler_name, new_count)
        entry["consecutive_zeros"] = 0
        entry["alerted"] = False
    else:
        entry["consecutive_zeros"] = entry.get("consecutive_zeros", 0) + 1
        logger.info(
            "Crawler %s returned 0 new results (%d consecutive)",
            crawler_name, entry["consecutive_zeros"],
        )

        if entry["consecutive_zeros"] >= ALERT_THRESHOLD and not entry.get("alerted"):
            await _send_health_alert(crawler_name, entry["consecutive_zeros"])
            entry["alerted"] = True

    state[crawler_name] = entry
    _save_state(state)


async def _send_health_alert(crawler_name: str, count: int):
    """Send a Telegram alert about a stalled crawler."""
    from api.services.notify import _send_telegram_message, _esc_md

    friendly = crawler_name.replace("_", " ").title()
    text = (
        f"⚠️ *Drone crawler alert*\n\n"
        f"`{_esc_md(friendly)}` has returned 0 new results "
        f"for *{count}* consecutive runs\\.\n\n"
        f"Check API quotas, rate limits, or search parameters\\."
    )
    ok = await _send_telegram_message(text)
    if ok:
        logger.info("Sent health alert for %s (%d consecutive zeros)", crawler_name, count)
    else:
        logger.error("Failed to send health alert for %s", crawler_name)
