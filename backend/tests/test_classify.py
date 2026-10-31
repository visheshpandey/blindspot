import pytest

from app.models import FetchedSource
from app.pipeline.classify import classify, credibility, detect_cycles, is_older, normalise_cycle


@pytest.mark.parametrize("host,expected", [
    ("scholarships.gov.in", "Primary"),
    ("scholarshipportal.mp.nic.in", "Primary"),
    ("socialjustice.gov.in", "Primary"),
    ("iitb.ac.in", "Institutional"),
    ("acropolis-university.in", "Institutional"),
    ("stanford.edu", "Institutional"),
    ("studenthelp.co.in", "Secondary"),
    ("medium.com", "Secondary"),
])
def test_credibility_tiers(host, expected):
    assert credibility(host) == expected


def test_unreadable_is_unverified():
    assert credibility("scholarships.gov.in", readable=False) == "Unverified"
    s = classify(FetchedSource(id="S1", url="https://x.gov.in", host="x.gov.in", name="x", state="Blocked"))
    assert s.type == "Unverified" and s.date == "Could not fetch page"


@pytest.mark.parametrize("raw,expected", [
    ("2026-27", "2026–27"), ("2026–2027", "2026–27"), ("session 2025/26", "2025–26"),
    ("30 November 2025", "2025"), ("", ""), ("no year", ""), ("2026-29", "2026"),
])
def test_normalise_cycle(raw, expected):
    assert normalise_cycle(raw) == expected


def test_context_lock_older():
    assert is_older("2025–26", "2026–27")
    assert is_older("30 November 2025", "2026–27")
    assert not is_older("2026-27", "2026–27")
    assert not is_older("", "2026–27")
    assert not is_older("2027–28", "2026–27")


def test_detect_cycles_and_classify():
    s = FetchedSource(id="S1", url="https://a.ac.in", host="a.ac.in", name="A University", state="Readable",
                      text="Updated on 18 Sep 2026. Applications for 2026-27 are open. Last year (2025-26) ...")
    classify(s)
    assert s.type == "Institutional"
    assert detect_cycles(s.text) == ["2026–27", "2025–26"]
    assert s.date.startswith("Updated")


def test_pasted_text_never_inherits_the_urls_authority():
    s = classify(FetchedSource(id="S1", url="https://scholarships.gov.in/", host="scholarships.gov.in", claimed_host="scholarships.gov.in",
                               name="Pasted text · claimed from scholarships.gov.in", state="Pasted", text="Applications for 2026-27 are open."))
    assert s.type == "Pasted"


def test_live_page_behind_pasted_text_keeps_its_own_tier():
    s = classify(FetchedSource(id="S1", url="https://scholarships.gov.in/", host="scholarships.gov.in", claimed_host="scholarships.gov.in",
                               name="Pasted text", state="Pasted", text="pasted", live_text="the live page"))
    assert s.type == "Pasted" and s.live_type == "Primary"
