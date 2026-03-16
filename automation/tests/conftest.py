"""
AJ Builds Drone — Shared test fixtures.

Async DB (SQLite in-memory), mock services, FastAPI test client.
"""

import asyncio
import sqlite3
import uuid
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from api.database import Base, get_db

# ── Ensure ALL models are imported/registered on Base.metadata before create_all ──
import api.models  # noqa: F401

# ── SQLite: teach it to bind Python uuid.UUID as TEXT ──
sqlite3.register_adapter(uuid.UUID, str)

# ── SQLite compatibility: patch PostgreSQL-specific column types ONCE at import ──
from sqlalchemy.dialects.postgresql import JSONB, ARRAY, UUID
from sqlalchemy import JSON, String

_types_patched = False

def _patch_pg_types_for_sqlite():
    """Replace PG-specific column types with SQLite-compatible ones.
    Must run BEFORE any engine create_all, and only once."""
    global _types_patched
    if _types_patched:
        return
    for table in Base.metadata.tables.values():
        for col in table.columns:
            if isinstance(col.type, JSONB):
                col.type = JSON()
            elif isinstance(col.type, ARRAY):
                col.type = JSON()
            elif isinstance(col.type, UUID):
                col.type = String(36)
    _types_patched = True

# Patch immediately since all models are already imported
_patch_pg_types_for_sqlite()


# ── Async Event Loop ──

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ── Test Database (SQLite in-memory) ──

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture()
async def db_engine():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture()
async def db_session(db_engine):
    session_factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture()
async def client(db_engine):
    """FastAPI test client with test DB injected."""
    session_factory = async_sessionmaker(db_engine, expire_on_commit=False)

    async def _override_get_db():
        async with session_factory() as session:
            yield session

    # Import app lazily to avoid circular imports
    from api.main import app

    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ── Mock services (autouse) ──

@pytest.fixture(autouse=True)
def mock_firebase():
    with patch("api.services.firebase.init_firebase", return_value=False), \
         patch("api.services.firebase._initialized", False), \
         patch("api.services.firebase.sync_contract_to_firebase", return_value=False), \
         patch("api.services.firebase.sync_invoice_to_firebase", return_value=False), \
         patch("api.services.firebase.sync_prospect_to_firebase", return_value=False), \
         patch("api.services.firebase.sync_activity_to_firebase", return_value=False), \
         patch("api.services.firebase.queue_email_for_approval", return_value=False), \
         patch("api.services.firebase.publish_contract_for_signing", return_value=False):
        yield


@pytest.fixture(autouse=True)
def mock_smtp():
    with patch("api.services.email_service.send_email", new_callable=AsyncMock, return_value=True):
        yield


@pytest.fixture(autouse=True)
def mock_telegram():
    with patch("api.services.notify._send_telegram_message", new_callable=AsyncMock, return_value=True):
        yield


@pytest.fixture(autouse=True)
def mock_scheduler():
    """Prevent agents from starting during tests."""
    with patch("api.agents.scheduler.scheduler.start", new_callable=AsyncMock), \
         patch("api.agents.scheduler.scheduler.stop", new_callable=AsyncMock):
        yield
