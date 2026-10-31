"""AI-written verify-next list, unanswered questions and notes. All labelled as AI in the UI."""
from __future__ import annotations

from ..llm import LLMUnavailable, call_json
from ..models import ActionsOut, ChecklistItem, Context, FetchedSource, Finding, UnansweredQuestion

QUESTION_TEMPLATES = {
    "missing": "Is {t} stated anywhere official for {y}?",
    "unverified": "What do the sources actually say about {t}?",
    "outdated": "What is the current {t} for {y}?",
    "conflict": "Which value for {t} applies to you?",
}
ACTION_TEMPLATES = {
    "conflict": ("Confirm the correct {t}", "Sources give different values."),
    "outdated": ("Find the {y} {t}", "The only evidence is from an earlier cycle."),
    "missing": ("Find official information on {t}", "Potential gap: none of the sources reviewed mention it."),
    "unverified": ("Check {t} manually or paste the page text", "Nothing in the sources could be checked for this item."),
}


def fallback(findings: list[Finding], ctx: Context) -> ActionsOut:
    order = {"conflict": 0, "outdated": 1, "missing": 2, "unverified": 3}
    open_items = sorted((f for f in findings if f.status in order), key=lambda f: (not f.critical, order[f.status]))
    checklist = []
    for n, f in enumerate(open_items[:7], start=1):
        text, why = ACTION_TEMPLATES[f.status]
        checklist.append(ChecklistItem(id=f"c{n}", text=text.format(t=f.title.lower(), y=ctx.year), why=why,
                                       where="The official scheme portal or issuing authority", critical=f.critical))
    questions = [UnansweredQuestion(finding_id=f.id, question=QUESTION_TEMPLATES[f.status].format(t=f.title.lower(), y=ctx.year))
                 for f in open_items]
    return ActionsOut(checklist=checklist, unanswered_questions=questions)


async def build_actions(question: str, ctx: Context, findings: list[Finding], sources: list[FetchedSource]) -> tuple[ActionsOut, bool]:
    try:
        out = await call_json(
            "actions", ActionsOut, temperature=0.3, question=question, **ctx.model_dump(),
            findings=[{"id": f.id, "title": f.title, "status": f.status, "critical": f.critical, "value": f.value,
                       "evidence": [{"source": e.source, "value": e.value, "cycle": e.date} for e in f.sources]} for f in findings],
            sources=[{"id": s.id, "name": s.name, "host": s.host, "type": s.type, "state": s.state} for s in sources],
        )
        ids = {f.id for f in findings}
        out.unanswered_questions = [q for q in out.unanswered_questions if q.finding_id in ids]
        if out.checklist:
            return out, False
    except LLMUnavailable:
        pass
    return fallback(findings, ctx), True
