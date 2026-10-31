import asyncio

from fastapi.testclient import TestClient

from app import traplab
from app.main import app
from app.pipeline.classify import credibility
from app.pipeline.dna import analyse
from app.pipeline.fetch import fetch_all


def _no_real_dns(host, port):
    raise AssertionError(f"real DNS lookup for {host}")


def test_trap_pages_go_through_the_normal_fetcher():
    sources = asyncio.run(fetch_all(traplab.URLS, {}, resolve=traplab.resolver(_no_real_dns), transport=traplab.TrapTransport()))
    assert [s.state for s in sources] == ["Readable"] * 5
    assert "Tehsildar" in sources[0].text
    assert "Rs 1,200 per month" in sources[1].text


def test_trap_tiers_and_real_hosts_unchanged():
    assert credibility("official.traplab.example") == "Primary"
    assert credibility("blog.traplab.example") == "Secondary"
    assert credibility("scholarships.gov.in") == "Primary"
    assert traplab.tier_for("traplab.example.com") is None  # look-alike domain is not a trap host


def test_copied_trap_is_one_voice():
    sources = asyncio.run(fetch_all(traplab.URLS, {}, resolve=traplab.resolver(_no_real_dns), transport=traplab.TrapTransport()))
    dna = analyse(sources)
    assert any({"S3", "S4"} <= set(group) for group in dna.clusters)


def test_traplab_routes():
    client = TestClient(app)
    info = client.get("/traplab").json()
    assert info["sources"] == traplab.URLS and len(info["traps"]) == 5
    page = client.get("/traplab/page/official/notice-2026-27")
    assert page.status_code == 200 and "Trap Lab" in page.text
    assert client.get("/traplab/page/official/nope").status_code == 404


def test_update_changes_official_deadline_only():
    client = TestClient(app)
    try:
        assert "30 November 2026" in client.get("/traplab/page/official/notice-2026-27").text
        client.post("/traplab/update?updated=true")
        assert "15 December 2026" in client.get("/traplab/page/official/notice-2026-27").text
        assert "31 October 2025" in client.get("/traplab/page/official/notice-2025-26").text
    finally:
        client.post("/traplab/update?updated=false")
