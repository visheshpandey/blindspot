import asyncio

import pytest

from app import cache, llm, ratelimit
from app.config import get_settings


@pytest.fixture(autouse=True)
def isolated_cache(tmp_path, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "cache_dir", tmp_path / "cache")
    # Tests never call the real AI service: keys are off unless a test turns one on with a mock.
    monkeypatch.setattr(settings, "gemini_api_key", "")
    monkeypatch.setattr(settings, "groq_api_key", "")
    cache.clear_memory()
    llm.STATUS.update(ok=None, reason="Not checked yet.", model="", checked_at=0.0)
    ratelimit.recent.clear()
    yield
    cache.clear_memory()


@pytest.fixture
def no_llm(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "gemini_api_key", "")
    monkeypatch.setattr(settings, "groq_api_key", "")


@pytest.fixture(autouse=True)
async def cancel_background_jobs():
    """Sample-mode jobs sleep between steps; cancel any left running so the event loop closes cleanly."""
    yield
    for task in asyncio.all_tasks():
        if task is not asyncio.current_task():
            task.cancel()
