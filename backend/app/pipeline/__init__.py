"""Pipeline orchestrator: checklist → fetch → classify → extract → verify → compare → score → actions."""
from __future__ import annotations

import asyncio
import hashlib
from collections import defaultdict
from datetime import datetime, timezone
from typing import Awaitable, Callable

from .. import cache
from ..llm import LLMUnavailable, call_json
from ..models import (TYPE_COLORS, AnalyzeRequest, Claim, FetchedSource, Finding, InvestigationResult, KeyFact,
                      PipelineEvent, SameMeaning, SourceOut)
from . import score
from .actions import build_actions
from .checklist import build_checklist
from .classify import classify
from .compare import assess_item, rule_same
from .dna import analyse as source_dna
from .extract import extract_all
from .fetch import _system_resolve, fetch_all
from .. import traplab
from .verify import is_verified

Emit = Callable[[PipelineEvent], Awaitable[None]]


def _title(question: str) -> str:
    q = question.strip().rstrip("?")
    return q if len(q) <= 70 else q[:67].rsplit(" ", 1)[0] + "…"


def source_out(s: FetchedSource) -> SourceOut:
    excerpt = s.error if s.state == "Blocked" else " ".join(s.text.split())[:160]
    note = ""
    if s.state == "Pasted":
        note = "Blindspot can't confirm this text came from that page." + (" Quotes also found on the live page are marked as confirmed." if s.live_text else "")
    return SourceOut(id=s.id, name=s.name, host=s.host, type=s.type, state=s.state, date=s.date, url=s.url,
                     color=TYPE_COLORS[s.type], excerpt=excerpt, undated=not s.date, note=note, live_checked=bool(s.live_text))


async def _judge_pairs(pairs: set[tuple[str, str, str]]) -> dict[tuple[str, str], bool]:
    async def one(title: str, a: str, b: str) -> tuple[tuple[str, str], bool]:
        try:
            res = await call_json("judge", SameMeaning, temperature=0.0, title=title, a=a, b=b)
            return (a, b), res.same
        except LLMUnavailable:
            return (a, b), False  # unsure → keep both visible as a possible conflict
    results = await asyncio.gather(*(one(*p) for p in pairs))
    return dict(results)


async def run_pipeline(req: AnalyzeRequest, investigation_id: str, emit: Emit) -> InvestigationResult:
    ctx = req.context
    warnings: list[str] = []

    await emit(PipelineEvent(step="checklist", progress=5, message="Working out what a complete answer must cover…"))
    items, fallback_checklist = await build_checklist(req.question, ctx)
    if fallback_checklist:
        warnings.append("The AI checklist was unavailable, so a standard checklist was used.")
    await emit(PipelineEvent(step="checklist", progress=12, message=f"Checklist ready: {len(items)} things to look for.",
                             detail={"items": [i.title for i in items]}))

    planned = [(u, req.pasted_text.get(u)) for u in req.sources] + [(k, t) for k, t in req.pasted_text.items() if k not in req.sources and t.strip()]
    plan = [{"id": f"S{n + 1}", "host": (u.split("/")[2] if u.startswith("http") else "pasted text"), "state": "Pasted" if t else "Fetching"} for n, (u, t) in enumerate(planned[:5])]
    await emit(PipelineEvent(step="fetch", progress=15, message="Knocking on each source's door…", detail={"sources": plan}))
    done_fetch = 0

    async def fetched(source: FetchedSource) -> None:
        nonlocal done_fetch
        done_fetch += 1
        label = {"Readable": "read", "Pasted": "pasted text", "Blocked": "could not read"}[source.state]
        await emit(PipelineEvent(step="fetch", progress=15 + round(10 * done_fetch / max(len(plan), 1)),
                                 message=f"{source.id} · {source.host}: {label}.",
                                 detail={"source": {"id": source.id, "host": source.host, "state": source.state, "live": bool(source.live_text)}}))

    if traplab.uses_traplab(req.sources):
        # Trap Lab pages are answered in-process; real URLs in the same case still go to the network.
        sources = await fetch_all(req.sources, req.pasted_text, resolve=traplab.resolver(_system_resolve),
                                  transport=traplab.TrapTransport(), on_done=fetched)
    else:
        sources = await fetch_all(req.sources, req.pasted_text, on_done=fetched)
    readable = [s for s in sources if s.readable]
    await emit(PipelineEvent(step="fetch", progress=25, message=f"Read {len(readable)} of {len(sources)} sources.",
                             detail={"sources": [{"id": s.id, "host": s.host, "state": s.state} for s in sources]}))

    for s in sources:
        classify(s)
    tiers = ", ".join(f"{s.id} {s.type}" for s in sources)
    dna = source_dna(sources)
    copies = f" Source DNA: {', '.join('+'.join(c) for c in dna.clusters)} look like copies." if dna.clusters else ""
    await emit(PipelineEvent(step="classify", progress=32, message=f"Checked who is speaking: {tiers}.{copies}"))

    result_key = cache.make_key(req.question, ctx.model_dump(), sorted(hashlib.sha256(s.text.encode()).hexdigest() + s.url for s in sources))
    hit = cache.get("result", result_key)
    if hit:
        result = InvestigationResult.model_validate({**hit, "investigation_id": investigation_id})
        if result.source_dna is None:
            result.source_dna = dna
        for step, p in (("extract", 55), ("verify", 65), ("compare", 78), ("score", 85), ("actions", 95)):
            await emit(PipelineEvent(step=step, progress=p, message="Reusing the evidence from a recent identical run."))
        return result

    done_count = 0

    async def extracted(source: FetchedSource, claims: list[Claim] | None) -> None:
        nonlocal done_count
        done_count += 1
        msg = f"Read {source.id} · {source.host}: {len(claims or [])} claims proposed." if claims is not None else f"Could not analyse {source.id}."
        await emit(PipelineEvent(step="extract", progress=35 + round(20 * done_count / max(len(readable), 1)), message=msg, detail={"source": source.id}))

    await emit(PipelineEvent(step="extract", progress=35, message="Reading every source for exact quotes…"))
    extracted_map = await extract_all(sources, items, req.question, ctx, on_done=extracted)
    failed = {sid for sid, claims in extracted_map.items() if claims is None}
    if failed:
        warnings.append(f"AI extraction failed for {', '.join(sorted(failed))}; items they might cover are marked as not verifiable.")

    texts = {s.id: s.text for s in sources}
    by_id = {s.id: s for s in sources}
    verified: list[Claim] = []
    dropped = 0
    for claims in extracted_map.values():
        for claim in claims or []:
            ok, match = is_verified(claim.quote, texts.get(claim.source_id, ""))
            if ok:
                claim.quote_match = match
                src = by_id.get(claim.source_id)
                if src and src.state == "Pasted" and src.live_text:
                    # A pasted quote that is also on the live page earns that page's authority.
                    claim.confirmed_live = is_verified(claim.quote, src.live_text)[0]
                    if claim.confirmed_live:
                        claim.tier = src.live_type
                verified.append(claim)
            else:
                dropped += 1
    await emit(PipelineEvent(step="verify", progress=65,
                             message=f"Found {len(verified)} quotes in their sources; dropped {dropped} that weren't found.",
                             detail={"kept": len(verified), "dropped": dropped}))

    by_item: dict[str, list[Claim]] = defaultdict(list)
    for c in verified:
        by_item[c.item_id].append(c)
    titles = {i.id: i.title for i in items}
    pairs: set[tuple[str, str, str]] = set()
    for item_id, claims in by_item.items():
        values = list(dict.fromkeys(c.value for c in claims))
        for i, a in enumerate(values):
            for b in values[i + 1:]:
                if rule_same(a, b) is None:
                    pairs.add((titles[item_id], a, b))
    judged = await _judge_pairs(pairs) if pairs else {}

    def same(a: str, b: str) -> bool | None:
        return judged.get((a, b), judged.get((b, a)))

    findings: list[Finding] = [
        assess_item(item, by_item.get(item.id, []), sources, ctx.year, ctx.location, same, failed) for item in items
    ]
    await emit(PipelineEvent(step="compare", progress=78, message="Compared sources by authority and context.",
                             detail={"statuses": {f.id: f.status for f in findings}}))

    analysed = sum(1 for s in sources if s.readable and s.id not in failed)
    coverage, blockers, verdict = score.coverage(findings), score.blockers(findings), score.verdict(findings, analysed)
    await emit(PipelineEvent(step="score", progress=85, message=f"Coverage {coverage}% · {len(blockers)} decision blocker(s) · {verdict}."))

    await emit(PipelineEvent(step="actions", progress=88, message="Writing what to verify next…"))
    actions, fallback_actions = await build_actions(req.question, ctx, findings, sources)
    if fallback_actions:
        warnings.append("AI suggestions were unavailable, so template suggestions were used.")
    for f in findings:
        if f.id in actions.notes and actions.notes[f.id].strip():
            f.note = actions.notes[f.id].strip()
    await emit(PipelineEvent(step="actions", progress=95, message=f"{len(actions.checklist)} things to verify next."))

    result = InvestigationResult(
        investigation_id=investigation_id,
        title=_title(req.question),
        question=req.question,
        context=ctx,
        coverage=coverage,
        verdict=verdict,
        blockers=blockers,
        sources=[source_out(s) for s in sources],
        findings=findings,
        key_facts=[KeyFact(finding_id=f.id, title=f.title, value=f.value, sources=list(dict.fromkeys(e.source for e in f.sources))) for f in findings],
        unanswered_questions=actions.unanswered_questions,
        checklist=actions.checklist,
        generated_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        mode="live",
        warnings=warnings,
        source_dna=dna,
    )
    if not failed and not fallback_checklist:
        cache.put("result", result_key, result.model_dump())
    return result
