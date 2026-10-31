"""AI-assisted language routes: email drafting and Hindi translation. All fall back gracefully when the AI is down."""
from fastapi import APIRouter

from .. import cache
from ..llm import STATUS, LLMUnavailable, call_json
from ..models import (EmailRequest, EmailResponse, ReportTranslateRequest, ReportTranslateResponse, TranslateRequest,
                      TranslateResponse, TranslationBatch)
from ..services.email import collect_points, template_draft

router = APIRouter(tags=["language"])

TRANSLATION_TTL = 30 * 24 * 3600  # a case's text never changes, so its translation can be kept


@router.post("/email", response_model=EmailResponse)
async def email(req: EmailRequest) -> EmailResponse:
    """Drafts an email. It never sends anything."""
    points = collect_points(req)
    try:
        out = await call_json("email", EmailResponse, temperature=0.3, topic=req.topic or req.question or "an application",
                              year=req.year or "the current cycle", points="\n".join(f"- {p}" for p in points) or "- General requirements")
        return out.model_copy(update={"is_ai": True})
    except LLMUnavailable:
        return template_draft(req, points)


@router.post("/translate/report", response_model=ReportTranslateResponse)
async def translate_report(req: ReportTranslateRequest) -> ReportTranslateResponse:
    """Translates every dynamic string of a report in ONE batched call, cached by (case, language, content)."""
    items = {k[:80]: v[:1200] for k, v in req.items.items() if v and v.strip()}
    key = cache.make_key(req.investigation_id, req.lang, items)
    hit = cache.get("translation", key, ttl=TRANSLATION_TTL)
    if hit:
        return ReportTranslateResponse(translations=hit, cached=True)
    try:
        out = await call_json("translate_batch", TranslationBatch, temperature=0.1, prefer=("gemini-3.5-flash-lite", "gemini-flash-lite-latest"),
                              items=items)
    except LLMUnavailable as err:
        return ReportTranslateResponse(translations={}, available=False, is_ai=False, reason=STATUS.get("reason") or str(err))
    translations = {k: v for k, v in out.t.items() if k in items and isinstance(v, str) and v.strip()}
    cache.put("translation", key, translations)
    return ReportTranslateResponse(translations=translations)


@router.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest) -> TranslateResponse:
    try:
        out = await call_json("translate", TranslateResponse, temperature=0.2, text=req.text)
        return TranslateResponse(translated_text=out.translated_text, is_ai=True, available=True)
    except LLMUnavailable:
        return TranslateResponse(translated_text=req.text, is_ai=False, available=False)
