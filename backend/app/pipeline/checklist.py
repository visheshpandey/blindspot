"""Checklist-first: decide what a complete answer must cover before reading any source."""
from __future__ import annotations

import re

from ..llm import LLMUnavailable, call_json
from ..models import CheckItem, Checklist, Context

FALLBACK = [
    CheckItem(id="eligibility", title="Eligibility conditions", category="Eligibility", critical=True, why="Decides whether you can apply at all."),
    CheckItem(id="documents", title="Required documents", category="Documents", critical=True, why="Missing documents are a common reason for rejection."),
    CheckItem(id="deadline", title="Application deadline", category="Timeline", critical=True, why="A missed date usually cannot be fixed."),
    CheckItem(id="amount", title="Amount or fees", category="Financial", critical=False, why="Tells you what you will receive or pay."),
    CheckItem(id="process", title="How to apply", category="Process", critical=False, why="The steps and the official place to apply."),
    CheckItem(id="renewal", title="Renewal or continuation", category="Renewal", critical=True, why="Whether you must reapply or meet conditions next year."),
    CheckItem(id="contact", title="Official contact", category="Contact", critical=False, why="Who can confirm anything unclear."),
]


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:40] or "item"


def tidy(items: list[CheckItem]) -> list[CheckItem]:
    seen: set[str] = set()
    out: list[CheckItem] = []
    for item in items[:10]:
        item.id = _slug(item.id or item.title)
        while item.id in seen:
            item.id += "-2"
        seen.add(item.id)
        out.append(item)
    if sum(i.critical for i in out) < 3:
        for item in out[:3]:
            item.critical = True
    return out


async def build_checklist(question: str, ctx: Context) -> tuple[list[CheckItem], bool]:
    """Returns (items, used_fallback)."""
    try:
        result = await call_json("checklist", Checklist, temperature=0.2, question=question, **ctx.model_dump())
        items = tidy(result.items)
        if len(items) >= 4:
            return items, False
    except LLMUnavailable:
        pass
    return [i.model_copy() for i in FALLBACK], True
