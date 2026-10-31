"""LLM client: Gemini in JSON mode with a model fallback chain, Pydantic validation, one retry, Groq fallback, 10-minute cache.

Every failure is logged with the provider's real error, and the latest outcome is kept in STATUS so /health
can report honestly whether AI is actually working (not just whether a key is configured).
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from pathlib import Path
from string import Template
from typing import TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from . import cache
from .config import get_settings

log = logging.getLogger("blindspot.llm")
PROMPTS = Path(__file__).parent / "prompts"
T = TypeVar("T", bound=BaseModel)

# Latest known state of the AI service, updated by every call and by probe().
STATUS: dict = {"ok": None, "reason": "Not checked yet.", "model": "", "checked_at": 0.0}


class LLMUnavailable(RuntimeError):
    """Raised when no provider produced valid output. Callers degrade gracefully."""


def _record(ok: bool, reason: str, model: str = "") -> None:
    STATUS.update(ok=ok, reason=reason, model=model, checked_at=time.time())


def describe_error(err: Exception) -> str:
    """Short, human-readable reason for a provider error (never includes the key)."""
    text = str(err)
    key = get_settings().gemini_api_key
    if key:
        text = text.replace(key, "[key]")
    if "429" in text or "RESOURCE_EXHAUSTED" in text:
        return "Quota exhausted for this model (429)."
    if "503" in text or "UNAVAILABLE" in text:
        return "Model temporarily overloaded (503)."
    if "404" in text or "NOT_FOUND" in text:
        return "Model name not available for this key (404)."
    if "401" in text or "403" in text or "API key" in text or "PERMISSION_DENIED" in text:
        return "API key rejected (401/403)."
    if isinstance(err, (asyncio.TimeoutError, TimeoutError)):
        return "The model took too long to answer."
    return text[:160]


def render(prompt_name: str, **values: object) -> str:
    template = Template((PROMPTS / f"{prompt_name}.md").read_text(encoding="utf-8"))
    return template.safe_substitute({k: v if isinstance(v, str) else json.dumps(v, ensure_ascii=False, indent=1) for k, v in values.items()})


def _strip_fences(raw: str) -> str:
    raw = raw.strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", raw, re.S)
    return m.group(1).strip() if m else raw


def _gemini_for(model: str):
    async def call(prompt: str, temperature: float) -> str:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=get_settings().gemini_api_key)
        # The SDK's async client hangs on Windows (google-genai 1.2), so run the sync call in a worker thread.
        resp = await asyncio.wait_for(asyncio.to_thread(
            client.models.generate_content,
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json", temperature=temperature),
        ), timeout=60)
        return resp.text or ""
    return call


async def _groq(prompt: str, temperature: float) -> str:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            json={
                "model": settings.groq_model,
                "temperature": temperature,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": "You return only valid JSON that matches the requested schema."},
                    {"role": "user", "content": prompt},
                ],
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


def providers() -> list[tuple[str, object]]:
    settings = get_settings()
    out: list[tuple[str, object]] = []
    if settings.gemini_api_key:
        out.extend((f"gemini:{m}", _gemini_for(m)) for m in settings.gemini_models)
    if settings.groq_api_key:
        out.append((f"groq:{settings.groq_model}", _groq))
    return out


async def call_json(prompt_name: str, schema: type[T], *, temperature: float = 0.0, prefer: tuple[str, ...] = (), **values: object) -> T:
    """Render a prompt, call the LLM, validate against `schema`. Retry once per model, then try the next model.
    `prefer` puts the named models first (e.g. fast lite models for translation)."""
    prompt = render(prompt_name, **values)
    prompt += "\n\nReturn ONLY a JSON object matching this JSON Schema:\n" + json.dumps(schema.model_json_schema(), ensure_ascii=False)
    key = cache.make_key(prompt_name, prompt)
    hit = cache.get("llm", key)
    if hit is not None:
        try:
            return schema.model_validate(hit)
        except ValidationError:
            pass

    reasons = []
    chain = providers()
    if prefer:
        chain = sorted(chain, key=lambda p: next((i for i, m in enumerate(prefer) if p[0].endswith(m)), len(prefer)))
    for name, provider in chain:
        attempt_prompt = prompt
        for attempt in (1, 2):
            try:
                raw = await provider(attempt_prompt, temperature)  # type: ignore[operator]
                parsed = schema.model_validate_json(_strip_fences(raw))
                cache.put("llm", key, parsed.model_dump())
                _record(True, "AI is answering.", name)
                return parsed
            except ValidationError as err:
                log.warning("%s returned invalid JSON for %s (attempt %d): %s", name, prompt_name, attempt, str(err)[:300])
                attempt_prompt = prompt + f"\n\nYour previous output was invalid: {str(err)[:600]}\nReturn only valid JSON."
                reasons.append(f"{name}: invalid JSON")
            except Exception as err:  # noqa: BLE001 - quota/network/model errors move on to the next model
                reason = describe_error(err)
                log.warning("%s failed for %s: %s | %s", name, prompt_name, reason, str(err)[:400].replace(get_settings().gemini_api_key or "\0", "[key]"))
                reasons.append(f"{name}: {reason}")
                break
    _record(False, "; ".join(reasons[-3:]) or "No AI provider is configured.")
    raise LLMUnavailable(f"No LLM produced valid output for {prompt_name}")


class _Ping(BaseModel):
    ok: bool


async def probe(max_age: float = 600.0, fail_age: float = 60.0) -> dict:
    """Cheap, cached test call so /health reports whether AI really works. Successes are trusted for 10 minutes."""
    settings = get_settings()
    if settings.llm_provider == "none":
        _record(False, "No AI key configured (GEMINI_API_KEY or GROQ_API_KEY).")
        return dict(STATUS)
    age = time.time() - STATUS["checked_at"]
    if STATUS["ok"] is True and age < max_age or STATUS["ok"] is False and age < fail_age:
        return dict(STATUS)
    for name, provider in providers():
        try:
            raw = await provider('Return exactly this JSON: {"ok": true}', 0.0)  # type: ignore[operator]
            if _Ping.model_validate_json(_strip_fences(raw)).ok:
                _record(True, "AI is answering.", name)
                return dict(STATUS)
        except Exception as err:  # noqa: BLE001
            log.warning("Health probe: %s failed: %s", name, describe_error(err))
            _record(False, f"{name}: {describe_error(err)}")
    return dict(STATUS)
