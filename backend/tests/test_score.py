from pathlib import Path

from app.models import Finding, InvestigationResult
from app.pipeline import score
from app.pipeline.score import VERDICT_RANK

SAMPLE = InvestigationResult.model_validate_json(
    (Path(__file__).parents[1] / "app" / "samples" / "scholarship.json").read_text(encoding="utf-8"))


def f(id, status, critical=True, evidence=True):
    srcs = [{"source": "S1", "value": "v", "quote": "q", "quote_match": 99}] if evidence else []
    return Finding(id=id, title=id, category="X", status=status, critical=critical, summary="", value="", sources=srcs)


def test_sample_numbers():
    assert score.coverage(SAMPLE.findings) == 67
    assert [b.finding_id for b in score.blockers(SAMPLE.findings)] == ["documents", "deadline", "renewal"]
    assert score.verdict(SAMPLE.findings) == "Not ready to decide"


def test_sample_file_agrees_with_rules():
    assert SAMPLE.coverage == score.coverage(SAMPLE.findings)
    assert SAMPLE.verdict == score.verdict(SAMPLE.findings)
    assert SAMPLE.blockers == score.blockers(SAMPLE.findings)


def test_fully_supported_is_ready():
    findings = [f("a", "supported"), f("b", "supported", critical=False)]
    assert score.coverage(findings) == 100
    assert score.blockers(findings) == []
    assert score.verdict(findings, analysed_sources=2) == "Ready to decide"


def test_zero_coverage_is_insufficient_evidence():
    # The QA case: 7 items, all "could not verify", 4 of them critical, 0% coverage.
    findings = [f(f"i{n}", "unverified", critical=n < 4, evidence=False) for n in range(7)]
    assert score.coverage(findings) == 0
    assert score.verdict(findings, analysed_sources=1) == "Insufficient evidence"


def test_nothing_analysed_is_insufficient_evidence():
    findings = [f("a", "supported"), f("b", "unverified", evidence=False)]
    assert score.verdict(findings, analysed_sources=0) == "Insufficient evidence"


def test_critical_unverified_is_a_blocker():
    findings = [f("a", "supported"), f("b", "unverified", evidence=False)]
    assert [b.finding_id for b in score.blockers(findings)] == ["b"]
    assert score.verdict(findings, analysed_sources=1) == "Not ready to decide"


def test_non_critical_unverified_is_caution():
    findings = [f("a", "supported"), f("b", "unverified", critical=False, evidence=False)]
    assert score.blockers(findings) == []
    assert score.verdict(findings, analysed_sources=1) == "Proceed with caution"


def test_mixed_results():
    findings = [f("a", "supported"), f("b", "conflict"), f("c", "missing", critical=False, evidence=False)]
    assert score.coverage(findings) == 67
    assert score.verdict(findings, analysed_sources=2) == "Not ready to decide"


def test_verdict_never_gets_friendlier_as_evidence_drops():
    """Remove evidence step by step: the verdict's strictness must never go down."""
    ladder = [
        [f("a", "supported"), f("b", "supported"), f("c", "supported", critical=False)],
        [f("a", "supported"), f("b", "supported"), f("c", "missing", critical=False, evidence=False)],
        [f("a", "supported"), f("b", "unverified", evidence=False), f("c", "missing", critical=False, evidence=False)],
        [f("a", "unverified", evidence=False), f("b", "unverified", evidence=False), f("c", "missing", critical=False, evidence=False)],
    ]
    ranks = [VERDICT_RANK[score.verdict(step, analysed_sources=1)] for step in ladder]
    assert ranks == sorted(ranks), ranks
    assert ranks[-1] == VERDICT_RANK["Insufficient evidence"]


def test_empty():
    assert score.coverage([]) == 0
    assert score.verdict([]) == "Insufficient evidence"
