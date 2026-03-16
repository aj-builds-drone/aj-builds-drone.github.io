"""
AJ Builds Drone — Telegram notification service.
"""

import re
import logging

import aiohttp

from api.config import settings

logger = logging.getLogger(__name__)


def _esc_md(s: str) -> str:
    return re.sub(r"([_*\[\]()~`>#+\-=|{}.!\\])", r"\\\1", str(s))


async def _send_telegram_message(text: str, parse_mode: str = "MarkdownV2") -> bool:
    token = settings.telegram_bot_token
    chat_id = settings.telegram_chat_id
    if not token or not chat_id:
        logger.warning("Telegram not configured — skipping notification")
        return False
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        async with aiohttp.ClientSession() as session:
            resp = await session.post(url, json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": parse_mode,
            })
            if resp.status != 200:
                body = await resp.text()
                logger.error(f"Telegram send failed ({resp.status}): {body}")
                return False
            return True
    except Exception as e:
        logger.error(f"Telegram send failed: {e}")
        return False


async def send_telegram_contract_signed(client_name: str, project_name: str, short_id: str) -> bool:
    text = "\n".join([
        "✍️ *Contract Signed\\!*",
        "",
        f"📋 *Contract:* `{_esc_md(short_id)}`",
        f"🏢 *Client:* {_esc_md(client_name)}",
        f"📦 *Project:* {_esc_md(project_name)}",
    ])
    return await _send_telegram_message(text)


async def send_telegram_new_prospect(name: str, org: str, source: str) -> bool:
    text = "\n".join([
        "🎯 *New Hot Prospect\\!*",
        "",
        f"👤 *Name:* {_esc_md(name)}",
        f"🏫 *Org:* {_esc_md(org)}",
        f"📡 *Source:* {_esc_md(source)}",
    ])
    return await _send_telegram_message(text)


async def send_telegram_emails_pending(count: int) -> bool:
    text = f"📬 *{count} outreach emails pending your approval\\!*\n\nReview them in the Drone Admin dashboard\\."
    return await _send_telegram_message(text)


async def send_telegram_discovery_complete(source: str, found: int, new: int) -> bool:
    text = "\n".join([
        f"🔍 *Discovery crawl complete:* {_esc_md(source)}",
        f"Found: {found} \\| New: {new}",
    ])
    return await _send_telegram_message(text)


async def send_telegram_reply_received(name: str, org: str, subject: str, sentiment: str = "") -> bool:
    emoji = {"positive": "🎉", "neutral": "📩", "requesting_info": "❓", "objection": "⚠️"}.get(sentiment, "💬")
    text = "\n".join([
        f"{emoji} *Reply received\\!*",
        "",
        f"👤 *From:* {_esc_md(name)}",
        f"🏫 *Org:* {_esc_md(org)}",
        f"📋 *Subject:* {_esc_md(subject[:60])}",
        f"📊 *Sentiment:* {_esc_md(sentiment or 'unknown')}",
    ])
    return await _send_telegram_message(text)
