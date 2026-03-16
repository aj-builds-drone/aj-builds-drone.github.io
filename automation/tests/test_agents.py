"""
AJ Builds Drone — Agent scheduler tests.
"""

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from api.agents.scheduler import AgentScheduler, AgentTask


class TestAgentScheduler:

    def test_register_agent(self):
        sched = AgentScheduler()
        sched.register("test", AsyncMock(return_value={"ok": True}), 3600)
        assert "test" in sched.agents
        assert sched.agents["test"].interval == 3600

    def test_get_status(self):
        sched = AgentScheduler()
        sched.register("a", AsyncMock(), 100)
        sched.register("b", AsyncMock(), 200)
        status = sched.get_status()
        assert status["running"] is False
        assert len(status["agents"]) == 2

    async def test_run_agent_now(self):
        sched = AgentScheduler()
        fn = AsyncMock(return_value={"found": 5, "new": 3})
        sched.register("test_agent", fn, 3600)

        result = await sched.run_agent_now("test_agent")
        assert result["found"] == 5
        fn.assert_awaited_once()

    async def test_run_nonexistent_agent(self):
        sched = AgentScheduler()
        result = await sched.run_agent_now("nonexistent")
        assert "error" in result

    async def test_agent_task_to_dict(self):
        task = AgentTask("test", AsyncMock(), 3600)
        d = task.to_dict()
        assert d["name"] == "test"
        assert d["runs"] == 0
        assert d["status"] == "idle"

    async def test_start_stop(self):
        sched = AgentScheduler()
        fn = AsyncMock(return_value={"ok": True})
        sched.register("test", fn, 999999)

        await sched.start()
        assert sched._running is True
        await asyncio.sleep(0.1)
        await sched.stop()
        assert sched._running is False
