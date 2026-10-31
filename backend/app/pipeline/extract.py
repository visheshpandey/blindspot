"""Per-source claim extraction with exact quotes. Claims are verified by code afterwards."""
from __future__ import annotations

import asyncio
import re

from ..llm import LLMUnavailable, call_json
from ..models import CheckItem, Claim, Context, Extraction, FetchedSource

MAX_CHARS = 48_000  # roughly 12k tokens
_STOP = {"the", "and", "for", "of", "to", "a", "or", "in", "on", "rules", "required", "details"}


def keywords(items: list[CheckItem]) -> set[str]:
    words: set[str] = set()
    for item in items:
        for w in re.findall(r"[a-z]{3,}", f"{item.title} {item.category}".lower()):
            if w not in _STOP:
                words.add(w[:6])  # crude stem: "document(s)", "deadline(s)"
    return words


def truncate(text: str, items: list[CheckItem], limit: int = MAX_CHARS) -> str:
    """Keep the text whole if it fits; otherwise keep paragraphs that mention checklist keywords first, in page order."""
    if len(text) <= limit:
        return text
    paras = [p for p in re.split(r"\n\s*\n|\n", text) if p.strip()]
    keys = keywords(items)
    scored = [(sum(k in p.lower() for k in keys), i) for i, p in enumerate(paras)]
    keep: set[int] = set()
    size = 0
    for score, i in sorted(scored, key=lambda s: (-s[0], s[1])):
        if size + len(paras[i]) > limit:
            continue
        keep.add(i)
        size += len(paras[i]) + 1
    return "\n".join(paras[i] for i in sorted(keep))


async def extract_source(source: FetchedSource, items: list[CheckItem], question: str, ctx: Context) -> list[Claim] | None:
    """Returns proposed claims (unverified), or None if the LLM failed for this source."""
    try:
        result = await call_json(
            "extract", Extraction, temperature=0.0,
            question=question, **ctx.model_dump(),
            items=[{"id": i.id, "title": i.title, "category": i.category} for i in items],
            source_id=source.id, host=source.host, text=truncate(source.text, items),
        )
    except LLMUnavailable:
        return None
    valid_ids = {i.id for i in items}
    claims = []
    for e in result.items:
        if e.found and e.item_id in valid_ids and e.exact_quote and e.value and e.exact_quote.strip().lower() != "not_found":
            claims.append(Claim(item_id=e.item_id, source_id=source.id, value=e.value.strip(), quote=e.exact_quote.strip(),
                                cycle=(e.date_or_cycle or "").strip(), url=source.url))
    return claims


async def extract_all(sources: list[FetchedSource], items: list[CheckItem], question: str, ctx: Context,
                      on_done=None) -> dict[str, list[Claim] | None]:
    sem = asyncio.Semaphore(3)

    async def run(source: FetchedSource) -> tuple[str, list[Claim] | None]:
        async with sem:
            claims = await extract_source(source, items, question, ctx)
            if on_done:
                await on_done(source, claims)
            return source.id, claims

    readable = [s for s in sources if s.readable]
    return dict(await asyncio.gather(*(run(s) for s in readable)))
