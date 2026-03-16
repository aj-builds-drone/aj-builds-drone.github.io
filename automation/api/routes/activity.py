"""
AJ Builds Drone — Activity Log API routes.
"""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db, async_session
from api.models.activity_log import ActivityLog

logger = logging.getLogger(__name__)
activity_router = APIRouter(prefix="/activity", tags=["activity"])


async def log_activity(
    entity_type: str,
    entity_id: str,
    action: str,
    description: str = "",
    icon: str = "📋",
    actor: str = "admin",
    metadata: dict | None = None,
    db: AsyncSession | None = None,
) -> None:
    entry = ActivityLog(
        id=str(uuid.uuid4()),
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        description=description,
        icon=icon,
        actor=actor,
        extra_data=metadata or {},
    )
    try:
        if db:
            db.add(entry)
        else:
            async with async_session() as session:
                session.add(entry)
                await session.commit()
    except Exception as e:
        logger.warning(f"Failed to write activity log: {e}")

    try:
        from api.services.firebase import sync_activity_to_firebase
        sync_activity_to_firebase({
            "id": entry.id,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "action": action,
            "description": description,
            "icon": icon,
            "actor": actor,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass


class ManualActivityRequest(BaseModel):
    entity_type: str
    entity_id: str
    action: str
    description: str = ""
    icon: str = "📋"
    actor: str = "admin"
    metadata: dict | None = None


@activity_router.post("")
async def create_manual_activity(
    req: ManualActivityRequest,
    db: AsyncSession = Depends(get_db),
):
    await log_activity(
        entity_type=req.entity_type,
        entity_id=req.entity_id,
        action=req.action,
        description=req.description,
        icon=req.icon,
        actor=req.actor,
        metadata=req.metadata,
        db=db,
    )
    await db.commit()
    return {"success": True, "message": "Activity logged"}


@activity_router.get("")
async def list_activities(
    entity_type: str | None = Query(None),
    entity_id: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(limit)
    if entity_type:
        stmt = stmt.where(ActivityLog.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(ActivityLog.entity_id == entity_id)
    result = await db.execute(stmt)
    logs = result.scalars().all()
    return {
        "activities": [
            {
                "id": log.id,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "action": log.action,
                "description": log.description,
                "icon": log.icon,
                "actor": log.actor,
                "metadata": log.extra_data or {},
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
        "total": len(logs),
    }
