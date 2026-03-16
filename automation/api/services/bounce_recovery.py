"""
Drone Bounce Recovery Agent — Re-discover emails for bounced professors.

When an email bounces, the prospect is marked "dead". But professors move
between universities — their old institutional email stops working while
their latest papers have their *current* email.

Strategy:
1. Run the full email hunter waterfall (now includes Semantic Scholar +
   CrossRef DOI paper email extraction)
2. If a NEW email is found (different from the bounced one), recover the
   prospect: set new email, reset status to "queued"
3. Respects a 24-hour cooldown to avoid hammering APIs

Runs on scheduler every 30 minutes, processes up to 10 bounced
prospects per batch.
"""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from api.database import async_session_factory
from api.models.prospect import DroneProspect, OutreachEmail
from api.services.drone_email_hunter import hunt_email_for_prospect

logger = logging.getLogger("drone.bounce_recovery")


async def recover_bounced_prospects(batch_size: int = 10) -> dict:
    """
    Find prospects marked dead due to bounce and try to re-discover
    their email from papers/publications.

    Returns summary dict.
    """
    result = {
        "checked": 0,
        "recovered": 0,
        "still_dead": 0,
        "skipped": 0,
        "details": [],
        "errors": [],
    }

    async with async_session_factory() as db:
        # Find dead prospects that had bounced emails
        bounced_prospects = (await db.execute(
            select(DroneProspect).where(
                DroneProspect.status == "dead",
                DroneProspect.notes.ilike("%bounced%"),
            ).order_by(
                DroneProspect.priority_score.desc().nullslast()
            ).limit(batch_size)
        )).scalars().all()

        if not bounced_prospects:
            logger.info("[BounceRecovery] No bounced prospects to recover")
            return result

        logger.info(
            "[BounceRecovery] Attempting recovery for %d bounced prospects",
            len(bounced_prospects),
        )

        for prospect in bounced_prospects:
            result["checked"] += 1
            old_email = prospect.email
            enrichment = prospect.enrichment or {}

            # Skip if already attempted recovery recently (within 24h)
            last_attempt = enrichment.get("bounce_recovery_at")
            if last_attempt:
                try:
                    last_dt = datetime.fromisoformat(last_attempt)
                    hours_ago = (
                        datetime.now(timezone.utc) - last_dt
                    ).total_seconds() / 3600
                    if hours_ago < 24:
                        result["skipped"] += 1
                        continue
                except (ValueError, TypeError):
                    pass

            # Record the attempt timestamp
            enrichment["bounce_recovery_at"] = datetime.now(timezone.utc).isoformat()
            enrichment["old_bounced_email"] = old_email
            prospect.enrichment = enrichment

            try:
                # Temporarily clear the email so the hunter runs the
                # full waterfall instead of skipping (already has email)
                prospect.email = None
                await db.flush()

                hunt_result = await hunt_email_for_prospect(
                    prospect, paper_first=True,
                )

                if (
                    hunt_result["email"]
                    and hunt_result["email"].lower() != (old_email or "").lower()
                ):
                    # Found a NEW email — recover the prospect
                    prospect.email = hunt_result["email"]
                    prospect.status = "queued"
                    enrichment["email_source"] = hunt_result["source"]
                    enrichment["email_found_at"] = (
                        datetime.now(timezone.utc).isoformat()
                    )
                    enrichment["recovered_from_bounce"] = True
                    prospect.enrichment = enrichment
                    prospect.notes = (prospect.notes or "") + (
                        f"\n✅ Recovered: {old_email} → {hunt_result['email']} "
                        f"via {hunt_result['source']}"
                    )

                    result["recovered"] += 1
                    result["details"].append({
                        "name": prospect.name,
                        "old_email": old_email,
                        "new_email": hunt_result["email"],
                        "source": hunt_result["source"],
                    })
                    logger.info(
                        "[BounceRecovery] ✅ %s: %s → %s (via %s)",
                        prospect.name, old_email, hunt_result["email"],
                        hunt_result["source"],
                    )
                else:
                    # No new email found — restore old email, keep dead
                    prospect.email = old_email
                    prospect.status = "dead"
                    prospect.enrichment = enrichment
                    result["still_dead"] += 1
                    logger.debug(
                        "[BounceRecovery] No new email for %s (%s)",
                        prospect.name, old_email,
                    )

            except Exception as e:
                # Restore on error
                prospect.email = old_email
                prospect.status = "dead"
                prospect.enrichment = enrichment
                result["errors"].append(f"{prospect.name}: {e}")
                logger.error(
                    "[BounceRecovery] Error for %s: %s", prospect.name, e
                )

            # Polite delay between prospects
            await asyncio.sleep(2)

        await db.commit()

    logger.info(
        "[BounceRecovery] Done: checked=%d recovered=%d still_dead=%d skipped=%d",
        result["checked"], result["recovered"],
        result["still_dead"], result["skipped"],
    )
    return result
