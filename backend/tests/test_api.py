import asyncio
import json

import httpx
import pytest

import app.pipeline as pipeline
from app import jobs, main
from app.config import get_settings
from app.llm import LLMUnavailable
from app.models import CheckItem, Checklist, ExtractedItem, Extraction, FetchedSource, InvestigationResult, PipelineEvent
from app.pipeline import actions, checklist, extract


@pytest.fixture
def client():
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test")


async def test_sample_matches_contract(client):
    r = await client.get("/sample")
    assert r.status_code == 200
    result = InvestigationResult.model_validate(r.json())
    assert result.mode == "demo" and result.coverage == 67 and len(result.blockers) == 3
    assert len(result.findings) == 6 and len(result.sources) == 5 and len(result.checklist) == 4


async def test_health(client):
    assert (await client.get("/health")).json()["status"] == "ok"


async def test_invalid_request_is_friendly(client):
    r = await client.post("/analyze", json={"question": "short", "sources": []})
    assert r.status_code == 422 and r.json()["error"]["code"] == "invalid_request"


async def test_bad_url_rejected(client):
    r = await client.post("/analyze", json={"question": "What should I verify first?", "sources": ["ftp://nope"]})
    assert r.status_code == 422


async def test_unknown_investigation_is_404(client):
    assert (await client.get("/analyze/INV-999")).status_code == 404


async def test_email_never_fails_without_llm(client, no_llm):
    r = await client.post("/email", json={"question": "Post-matric scholarship", "year": "2026–27",
                                          "blockers": [{"finding_id": "renewal", "status": "missing"}]})
    body = r.json()
    assert r.status_code == 200 and "renewal" in body["body"] and body["is_ai"] is False


async def test_translate_fallback(client, no_llm):
    r = await client.post("/translate", json={"text": "Hello", "language": "hi"})
    assert r.json() == {"translated_text": "Hello", "is_ai": False, "available": False}


async def test_demo_mode_analyze_streams_to_done(client, no_llm):
    r = await client.post("/analyze", json={"question": "What should I verify before applying?", "sources": ["https://example.com"]})
    assert r.status_code == 202
    iid = r.json()["investigation_id"]
    await asyncio.wait_for(jobs.jobs[iid].done.wait(), 10)
    assert (await client.get(f"/analyze/{iid}")).json()["mode"] == "demo"


PAGE = ("National Scholarship Portal. Applications for 2026-27 are open. "
        "The annual income of parents from all sources should not exceed Rs. 2,50,000. "
        "A valid income certificate issued by the competent authority must be uploaded. " + "Filler text. " * 30)


async def test_live_pipeline_with_mocked_llm(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "gemini_api_key", "test-key")

    async def fake_call(prompt_name, schema, **_):
        if schema is Checklist:
            return Checklist(items=[CheckItem(id="income", title="Income limit", category="Eligibility", critical=True),
                                    CheckItem(id="documents", title="Documents", category="Documents", critical=True),
                                    CheckItem(id="deadline", title="Deadline", category="Timeline", critical=True),
                                    CheckItem(id="renewal", title="Renewal", category="Renewal", critical=False)])
        if schema is Extraction:
            return Extraction(items=[
                ExtractedItem(item_id="income", found=True, value="Up to ₹2.5 lakh", exact_quote="should not exceed Rs. 2,50,000", date_or_cycle="2026-27"),
                ExtractedItem(item_id="documents", found=True, value="Income certificate",
                              exact_quote="A valid income certificate issued by the competent authority", date_or_cycle="2026-27"),
                # Fabricated: not on the page, so verify must drop it.
                ExtractedItem(item_id="deadline", found=True, value="31 Dec", exact_quote="The last date is 31 December 2026 for all applicants", date_or_cycle="2026-27"),
            ])
        raise LLMUnavailable("not mocked")

    for mod in (checklist, extract, actions, pipeline):
        monkeypatch.setattr(mod, "call_json", fake_call)

    async def fake_fetch(urls, pasted, on_done=None, **_):
        source = FetchedSource(id="S1", url=urls[0], host="scholarships.gov.in", name="NSP", text=PAGE, state="Readable")
        if on_done:
            await on_done(source)
        return [source]
    monkeypatch.setattr(pipeline, "fetch_all", fake_fetch)

    r = await client.post("/analyze", json={"question": "What should I verify before applying?", "sources": ["https://scholarships.gov.in/"]})
    iid = r.json()["investigation_id"]
    await asyncio.wait_for(jobs.jobs[iid].done.wait(), 10)

    async with client.stream("GET", f"/analyze/{iid}/events") as stream:
        events = [PipelineEvent(**json.loads(line[6:])) async for line in stream.aiter_lines() if line.startswith("data: ")]
    steps = [e.step for e in events]
    for step in ["checklist", "fetch", "classify", "extract", "verify", "compare", "score", "actions", "done"]:
        assert step in steps

    result = InvestigationResult.model_validate((await client.get(f"/analyze/{iid}")).json())
    by_id = {f.id: f for f in result.findings}
    assert result.mode == "live"
    assert by_id["income"].status == "supported" and by_id["income"].sources[0].quote_match >= 85
    assert by_id["income"].sources[0].date == "2026–27"
    assert by_id["deadline"].status == "missing"  # fabricated quote dropped -> potential gap
    assert by_id["renewal"].status == "missing"
    assert result.coverage == 50
    assert result.verdict == "Not ready to decide"
    assert result.checklist and result.unanswered_questions  # template fallback still works
    assert result.sources[0].type == "Primary"
