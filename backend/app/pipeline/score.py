"""Coverage, decision blockers and verdict. Pure code.

Verdicts only get stricter as evidence drops:
  Insufficient evidence  >  Not ready to decide  >  Proceed with caution  >  Ready to decide
"""
from __future__ import annotations

from ..models import BLOCKER_STATUSES, Blocker, Finding, Verdict

VERDICT_RANK: dict[str, int] = {"Ready to decide": 0, "Proceed with caution": 1, "Not ready to decide": 2, "Insufficient evidence": 3}


def coverage(findings: list[Finding]) -> int:
    if not findings:
        return 0
    covered = sum(1 for f in findings if f.sources)
    return round(100 * covered / len(findings))


def blockers(findings: list[Finding]) -> list[Blocker]:
    """A blocker is a critical item that is a possible conflict, possibly outdated, a potential gap, or could not be verified."""
    return [Blocker(finding_id=f.id, status=f.status) for f in findings if f.critical and f.status in BLOCKER_STATUSES]


def verdict(findings: list[Finding], analysed_sources: int | None = None) -> Verdict:
    """`analysed_sources` = readable sources whose AI extraction succeeded. 0 means nothing could be checked."""
    if not findings or coverage(findings) == 0 or analysed_sources == 0:
        return "Insufficient evidence"
    if blockers(findings):
        return "Not ready to decide"
    if any(f.status != "supported" for f in findings):
        return "Proceed with caution"
    return "Ready to decide"
