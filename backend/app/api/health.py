"""GET /health and GET /sample."""
from fastapi import APIRouter

from ..config import get_settings
from ..llm import probe
from ..models import InvestigationResult
from ..services.samples import load_sample

router = APIRouter(tags=["status"])


@router.get("/health")
async def health() -> dict:
    """Reports whether AI really works (a cheap cached test call), not just whether a key is set."""
    provider = get_settings().llm_provider
    status = await probe()
    return {"status": "ok", "llm": provider, "llm_ok": bool(status["ok"]), "llm_reason": status["reason"], "llm_model": status["model"],
            "mode": "demo" if provider == "none" else "live"}


@router.get("/sample", response_model=InvestigationResult)
async def sample() -> InvestigationResult:
    return load_sample()
