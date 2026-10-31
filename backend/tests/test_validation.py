import re

import httpx
import pytest

from app import llm, main, ratelimit
from app.config import get_settings
from app.services.email import short_subject

GOOD = {"question": "What should I verify before applying?", "year": "2026–27", "location": "Madhya Pradesh",
        "category": "Undergraduate student", "sources": ["https://scholarships.gov.in/"]}


@pytest.fixture
def client():
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test")


@pytest.mark.parametrize("patch", [
    {"question": "            "},                                             # whitespace only
    {"question": "   short   "},                                             # under 10 after strip
    {"question": "x" * 501},                                                  # too long
    {"sources": ["http://scholarships.gov.in/"]},                             # http, not https
    {"sources": ["https://Scholarships.gov.in/", "https://scholarships.gov.in#top"]},  # duplicate after normalising
    {"sources": ["not a url"]},
    {"year": "DROP TABLE"},
    {"location": "Atlantis"},
    {"category": "Astronaut"},
    {"pasted_text": {"https://other.example/": "Some pasted page text that is long enough to matter."}},  # orphan key
    {"pasted_text": {"pasted://source-9": "text"}},                           # index out of range
    {"pasted_text": {"https://scholarships.gov.in/": "x" * 50_001}},          # too long
])
async def test_invalid_requests_are_422_in_the_error_format(client, patch):
    r = await client.post("/analyze", json={**GOOD, **patch})
    assert r.status_code == 422, r.text
    body = r.json()
    assert body["error"]["code"] == "invalid_request" and body["error"]["message"]


async def test_valid_request_with_pasted_text_is_accepted(client):
    r = await client.post("/analyze", json={**GOOD, "sources": [], "pasted_text": {"pasted://source-1": "Full page text pasted by the user."}})
    assert r.status_code == 202


async def test_case_ids_are_random(client):
    ids = [(await client.post("/analyze", json=GOOD)).json()["investigation_id"] for _ in range(3)]
    assert all(re.fullmatch(r"INV-[A-Za-z0-9_-]{10}", i) for i in ids)
    assert len(set(ids)) == 3


async def test_rate_limit_per_ip(client):
    codes = [(await client.post("/analyze", json=GOOD)).status_code for _ in range(ratelimit.RATE_LIMIT + 1)]
    assert codes[:ratelimit.RATE_LIMIT] == [202] * ratelimit.RATE_LIMIT
    assert codes[-1] == 429


async def test_health_reports_no_ai_honestly(client):
    body = (await client.get("/health")).json()
    assert body["llm_ok"] is False and "No AI key" in body["llm_reason"]


async def test_health_reports_failing_ai(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "gemini_api_key", "test-key")

    async def quota(prompt, temperature):
        raise RuntimeError("429 RESOURCE_EXHAUSTED. You exceeded your current quota")
    monkeypatch.setattr(llm, "providers", lambda: [("gemini:test", quota)])
    body = (await client.get("/health")).json()
    assert body["mode"] == "live" and body["llm_ok"] is False and "Quota" in body["llm_reason"]


async def test_health_reports_working_ai(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "gemini_api_key", "test-key")

    async def ok(prompt, temperature):
        return '{"ok": true}'
    monkeypatch.setattr(llm, "providers", lambda: [("gemini:test", ok)])
    body = (await client.get("/health")).json()
    assert body["llm_ok"] is True and body["llm_model"] == "gemini:test"


async def test_model_fallback_chain_uses_next_model(monkeypatch):
    from pydantic import BaseModel

    class Out(BaseModel):
        ok: bool
    monkeypatch.setattr(get_settings(), "gemini_api_key", "test-key")

    async def exhausted(prompt, temperature):
        raise RuntimeError("429 RESOURCE_EXHAUSTED")

    async def fine(prompt, temperature):
        return '{"ok": true}'
    monkeypatch.setattr(llm, "providers", lambda: [("gemini:a", exhausted), ("gemini:b", fine)])
    out = await llm.call_json("judge", Out, title="t", a="1", b="2")
    assert out.ok and llm.STATUS["model"] == "gemini:b"


async def test_email_uses_open_items_and_full_question(client):
    question = "What should I verify before applying for the post-matric scholarship in Madhya Pradesh this year?"
    r = await client.post("/email", json={"topic": question, "question": question, "year": "2026–27",
                                          "points": ["Sources disagree on required income document.", "I could not check renewal rules."]})
    body = r.json()
    assert "1. Sources disagree on required income document." in body["body"]
    assert "2. I could not check renewal rules." in body["body"]
    assert "…" not in body["subject"] and "…" not in body["body"]
    assert question in body["body"]


def test_short_subject_ends_on_a_word():
    s = short_subject("What should I verify before applying for the post-matric scholarship in Madhya Pradesh this year?", 40)
    assert len(s) <= 40 and not s.endswith(" ") and "…" not in s
    assert "What should I verify before applying for".startswith(s)


async def test_report_translation_is_batched_and_cached(client, monkeypatch):
    calls = []
    monkeypatch.setattr(get_settings(), "gemini_api_key", "test-key")

    async def fake(prompt, temperature):
        calls.append(prompt)
        return '{"t": {"title:a": "आय सीमा", "note:a": "जाँच करें"}}'
    monkeypatch.setattr(llm, "providers", lambda: [("gemini:gemini-3.5-flash-lite", fake)])
    body = {"investigation_id": "INV-x", "lang": "hi", "items": {"title:a": "Income limit", "note:a": "Check it"}}
    first = (await client.post("/translate/report", json=body)).json()
    second = (await client.post("/translate/report", json=body)).json()
    assert first["translations"]["title:a"] == "आय सीमा" and not first["cached"]
    assert second["cached"] and len(calls) == 1


async def test_report_translation_failure_is_reported(client):
    r = (await client.post("/translate/report", json={"investigation_id": "INV-x", "items": {"a": "Hello"}})).json()
    assert r["available"] is False and r["translations"] == {} and r["reason"]


async def test_cancel_stops_a_running_case(client, monkeypatch):
    import asyncio
    monkeypatch.setattr(get_settings(), "gemini_api_key", "test-key")

    async def slow(*a, **k):
        await asyncio.sleep(30)
    import app.pipeline as pipeline
    monkeypatch.setattr(pipeline, "build_checklist", slow)
    iid = (await client.post("/analyze", json=GOOD)).json()["investigation_id"]
    await asyncio.sleep(0.05)
    assert (await client.post(f"/analyze/{iid}/cancel")).json()["status"] == "cancelled"
    assert (await client.get(f"/analyze/{iid}")).status_code == 500
