from app.models import CheckItem, Claim, FetchedSource
from app.pipeline.compare import assess_item, rule_same

ITEM = CheckItem(id="documents", title="Required income document", category="Documents", critical=True)
CTX = ("2026–27", "Madhya Pradesh")


def src(id, host, type, state="Readable"):
    return FetchedSource(id=id, url=f"https://{host}/", host=host, name=host,
                         text="" if state == "Blocked" else "x" * 300, state=state, type=type)


SOURCES = [src("S1", "scholarships.gov.in", "Primary"), src("S2", "uni.ac.in", "Institutional"),
           src("S3", "blog.in", "Secondary"), src("S4", "help.in", "Secondary")]


def claim(sid, value, cycle="2026–27"):
    return Claim(item_id="documents", source_id=sid, value=value, quote=f"quote for {value}", quote_match=95, cycle=cycle)


def test_context_lock_old_cycle_is_outdated_not_conflict():
    f = assess_item(ITEM, [claim("S2", "30 November 2025", "2025–26")], SOURCES, *CTX)
    assert f.status == "outdated"


def test_old_cycle_disagreement_does_not_create_conflict():
    claims = [claim("S1", "Income certificate"), claim("S4", "ITR acknowledgement", "2025–26")]
    f = assess_item(ITEM, claims, SOURCES, *CTX, lambda a, b: False)
    assert f.status == "supported" and f.value == "Income certificate"
    assert len(f.sources) == 2  # the older claim stays visible


def test_primary_over_secondary_same_context():
    claims = [claim("S3", "ITR acknowledgement"), claim("S4", "ITR acknowledgement"), claim("S1", "Income certificate")]
    f = assess_item(ITEM, claims, SOURCES, *CTX, lambda a, b: False)
    assert f.status == "conflict"
    assert f.value == "Income certificate"  # one official source outranks two copied blogs
    assert {e.source for e in f.sources} == {"S1", "S3", "S4"}
    assert f.sources[0].source == "S1"


def test_agreement_is_supported():
    claims = [claim("S1", "Up to ₹2.5 lakh per annum"), claim("S2", "₹2,50,000 per year")]
    assert assess_item(ITEM, claims, SOURCES, *CTX).status == "supported"


def test_undated_secondary_cannot_overturn_dated_primary():
    claims = [claim("S1", "Up to ₹2.5 lakh"), claim("S3", "Below ₹2 lakh", cycle="")]
    f = assess_item(ITEM, claims, SOURCES, *CTX)
    assert f.status == "supported" and f.undated


def test_unreadable_only_is_unverified():
    blocked = [src("S1", "x.gov.in", "Unverified", "Blocked")]
    assert assess_item(ITEM, [], blocked, *CTX).status == "unverified"


def test_failed_extraction_counts_as_unreadable():
    f = assess_item(ITEM, [], SOURCES[:1], *CTX, failed_sources={"S1"})
    assert f.status == "unverified"
    # The page was read; only the AI step failed. Say so, and never call it unreadable.
    assert "couldn't extract quotes from scholarships.gov.in" in f.summary
    assert "unreadable" not in f.summary.lower() and "could not be read" not in f.summary.lower()


def test_truly_unreadable_sources_keep_their_own_wording():
    blocked = [src("S1", "x.gov.in", "Unverified", "Blocked")]
    assert "could be read" in assess_item(ITEM, [], blocked, *CTX).summary


def test_readable_but_absent_is_missing():
    f = assess_item(ITEM, [], SOURCES, *CTX)
    assert f.status == "missing" and "Potential gap" in f.summary


def test_other_state_is_different_context():
    f = assess_item(ITEM, [claim("S3", "Income limit for Uttar Pradesh is ₹2 lakh")], SOURCES, *CTX)
    assert f.status == "unverified" and "Uttar Pradesh" in f.value


def test_rule_same():
    assert rule_same("Up to ₹2.5 lakh", "₹2,50,000") is True
    assert rule_same("₹2 lakh", "₹2.5 lakh") is False
    assert rule_same("Income certificate", "ITR acknowledgement") is None
    assert rule_same("30 November 2025", "30/11/2025") is None


def test_pasted_source_ranks_below_secondary_unless_confirmed_live():
    pasted = FetchedSource(id="S5", url="https://scholarships.gov.in/", host="scholarships.gov.in", name="Pasted", text="x" * 300, state="Pasted", type="Pasted")
    srcs = SOURCES + [pasted]
    weak = [claim("S5", "Income certificate"), claim("S3", "ITR acknowledgement")]
    f = assess_item(ITEM, weak, srcs, *CTX, lambda a, b: False)
    assert f.status == "conflict" and f.sources[0].source == "S3"  # the blog outranks unconfirmed pasted text
    confirmed = claim("S5", "Income certificate")
    confirmed.confirmed_live, confirmed.tier = True, "Primary"
    f = assess_item(ITEM, [confirmed, claim("S3", "ITR acknowledgement")], srcs, *CTX, lambda a, b: False)
    assert f.sources[0].source == "S5" and f.sources[0].confirmed_live and f.value == "Income certificate"
