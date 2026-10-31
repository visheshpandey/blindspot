"""Turn verified claims into a status per checklist item.

Rules come first and are pure code (context lock, authority, missing vs unverified).
The LLM is only asked one narrow question: do two differently worded values mean the same thing?
Its answers are passed in as `same_meaning`, so this module stays deterministic and testable.
"""
from __future__ import annotations

import re
from typing import Callable

from ..models import CheckItem, Claim, Evidence, FetchedSource, Finding
from .classify import is_older, normalise_cycle
from .verify import normalise

TIER_RANK = {"Primary": 0, "Institutional": 1, "Secondary": 2, "Pasted": 3, "Unverified": 4}
INDIAN_STATES = [
    "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh", "goa", "gujarat", "haryana",
    "himachal pradesh", "jharkhand", "karnataka", "kerala", "madhya pradesh", "maharashtra", "manipur",
    "meghalaya", "mizoram", "nagaland", "odisha", "punjab", "rajasthan", "sikkim", "tamil nadu", "telangana",
    "tripura", "uttar pradesh", "uttarakhand", "west bengal", "delhi", "jammu and kashmir", "ladakh",
]
_NUM = re.compile(r"\d+(?:\.\d+)?")

SameMeaning = Callable[[str, str], bool | None]


_SCALE = re.compile(r"(\d+(?:\.\d+)?)\s*(lakh|lac|crore|k)\b", re.I)
_MONTHS = re.compile(r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b", re.I)
_MULT = {"lakh": 100_000, "lac": 100_000, "crore": 10_000_000, "k": 1_000}


def _numbers(text: str) -> set[float]:
    text = re.sub(r"(?<=\d),(?=\d)", "", text or "")
    text = _SCALE.sub(lambda m: str(float(m.group(1)) * _MULT[m.group(2).lower()]), text)
    return {float(n) for n in _NUM.findall(text)}


def rule_same(a: str, b: str) -> bool | None:
    """Cheap deterministic check. True/False when sure, None when the LLM judge should decide."""
    na, nb = normalise(a), normalise(b)
    if na == nb:
        return True
    nums_a, nums_b = _numbers(a), _numbers(b)
    if nums_a and nums_b:
        if nums_a == nums_b:
            return True
        if nums_a.isdisjoint(nums_b) and not (_MONTHS.search(a) or _MONTHS.search(b)):
            return False
        return None
    if na in nb or nb in na:
        return True
    return None


def other_state(claim: Claim, location: str) -> str:
    text = f"{claim.value} {claim.quote}".lower()
    loc = location.lower()
    for state in INDIAN_STATES:
        if state != loc and re.search(rf"\b{re.escape(state)}\b", text):
            return state.title()
    return ""


def group_claims(claims: list[Claim], same_meaning: SameMeaning) -> list[list[Claim]]:
    groups: list[list[Claim]] = []
    for claim in claims:
        for group in groups:
            head = group[0].value
            verdict = rule_same(head, claim.value)
            if verdict is None:
                verdict = same_meaning(head, claim.value)
            if verdict:
                group.append(claim)
                break
        else:
            groups.append([claim])
    return groups


def _tier(c: Claim, tier: dict[str, str]) -> str:
    return c.tier or tier.get(c.source_id, "Unverified")


def _rank(c: Claim, tier: dict[str, str]) -> int:
    return TIER_RANK.get(_tier(c, tier), 4)


def _best(claims: list[Claim], tier: dict[str, str]) -> Claim:
    return sorted(claims, key=lambda c: (_rank(c, tier), -(int(normalise_cycle(c.cycle)[:4] or 0))))[0]


def assess_item(
    item: CheckItem,
    claims: list[Claim],
    sources: list[FetchedSource],
    locked_year: str,
    location: str,
    same_meaning: SameMeaning = lambda a, b: None,
    failed_sources: set[str] | None = None,
) -> Finding:
    failed_sources = failed_sources or set()
    tier = {s.id: s.type for s in sources}
    names = {s.id: s.name for s in sources}
    analysed = [s for s in sources if s.readable and s.id not in failed_sources]

    evidence = [
        Evidence(source=c.source_id, value=c.value, quote=c.quote, quote_match=c.quote_match,
                 date=normalise_cycle(c.cycle) or c.cycle or "Not specified", url=c.url, confirmed_live=c.confirmed_live)
        for c in sorted(claims, key=lambda c: _rank(c, tier))
    ]
    undated = any(not c.cycle for c in claims)
    base = dict(id=item.id, title=item.title, category=item.category, critical=item.critical, sources=evidence, undated=undated)

    if not claims:
        if not analysed:
            # Keep the two causes apart: pages we fetched but couldn't extract from, versus pages we couldn't read at all.
            not_extracted = [s.name for s in sources if s.readable and s.id in failed_sources]
            if not_extracted:
                names = ", ".join(not_extracted)
                return Finding(**base, status="unverified", value="Could not verify",
                               summary=f"We couldn't extract quotes from {names}; check it manually or paste its text.",
                               note=f"{names} was read, but the AI step failed for it, so nothing in it could be checked.")
            return Finding(**base, status="unverified", value="Could not verify",
                           summary="None of the sources could be read, so this item could not be checked.",
                           note="Paste the page text or check the source manually before relying on it.")
        return Finding(**base, status="missing", value="Not found in supplied sources",
                       summary=f"Potential gap: none of the {len(analysed)} analysed source(s) mention {item.title.lower()}.",
                       note="Check the official guidelines or ask the authority. Not finding it here does not mean it does not exist.")

    old = [c for c in claims if c.cycle and is_older(c.cycle, locked_year)]
    elsewhere = [c for c in claims if c not in old and other_state(c, location)]
    current = [c for c in claims if c not in old and c not in elsewhere and c.cycle]
    undated_claims = [c for c in claims if c not in old and c not in elsewhere and not c.cycle]

    if not current and not undated_claims:
        best = _best(old or elsewhere, tier)
        if old:
            return Finding(**base, status="outdated", value=f"{best.value} (from {normalise_cycle(best.cycle) or best.cycle})",
                           summary=f"Possibly outdated: the only evidence belongs to an earlier cycle than {locked_year}.",
                           note=f"Do not reuse this for {locked_year} until a current source confirms it.")
        state = other_state(best, location)
        return Finding(**base, status="unverified", value=f"{best.value} (for {state})",
                       summary=f"Evidence found only for a different state ({state}), not {location}.",
                       note=f"Look for the {location} version of this rule.")

    # Undated claims join the comparison only when there is no dated evidence for the locked cycle.
    # An undated claim cannot be placed in the locked context, so it cannot overturn a dated one.
    compared = current or undated_claims
    groups = group_claims(compared, same_meaning)
    best = _best(compared, tier)

    if len(groups) > 1:
        values = " / ".join(dict.fromkeys(_best(g, tier).value for g in groups))
        primary_led = _rank(best, tier) < min(_rank(_best(g, tier), tier) for g in groups if best not in g)
        value = best.value if primary_led else f"{values} — needs confirmation"
        return Finding(**base, status="conflict", value=value,
                       summary=f"Possible conflict: sources for {locked_year} give different values ({values}).",
                       note=(f"{names.get(best.source_id, best.source_id)} ({_tier(best, tier)}) is the most authoritative source here; "
                             "the other claims stay visible until you confirm.") if primary_led else
                            "Confirm which value applies to your situation with the official source.")

    extra = ""
    disagreeing = [c for c in undated_claims + old if current and rule_same(best.value, c.value) is False]
    if disagreeing:
        extra = " Some undated or older sources give a different value; they are shown below but do not override it."
    return Finding(**base, status="supported", value=best.value,
                   summary=f"Supported by {len({c.source_id for c in compared})} source(s); "
                           f"strongest: {names.get(best.source_id, best.source_id)} ({_tier(best, tier)}).{extra}",
                   note="A quote was found in the source. That shows the source says this, not that it is true.")
