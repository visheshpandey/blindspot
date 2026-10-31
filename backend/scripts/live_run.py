"""Run one live investigation against real public pages and save the result for the README.

Usage (from backend/, with GEMINI_API_KEY in backend/.env):
    .venv/Scripts/python -m scripts.live_run
    .venv/Scripts/python -m scripts.live_run "Your question" https://page-one https://page-two
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from app.config import get_settings
from app.models import AnalyzeRequest, PipelineEvent
from app.pipeline import run_pipeline

DEFAULT_QUESTION = "What should I verify before applying for the post-matric scholarship?"
DEFAULT_URLS = [
    "https://scholarships.gov.in/",
    "https://socialjustice.gov.in/schemes/25",
    "https://en.wikipedia.org/wiki/Post_Matric_Scholarship_for_Scheduled_Castes",
]
OUT = Path(__file__).resolve().parents[2] / "docs" / "live-run.json"


async def main() -> None:
    if get_settings().llm_provider == "none":
        sys.exit("No LLM key found. Add GEMINI_API_KEY (or GROQ_API_KEY) to backend/.env first.")
    question = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_QUESTION
    urls = sys.argv[2:] or DEFAULT_URLS
    req = AnalyzeRequest(question=question, sources=urls)

    async def emit(event: PipelineEvent) -> None:
        print(f"[{event.progress:3d}%] {event.step:<9} {event.message}")

    result = await run_pipeline(req, "INV-LIVE", emit)
    OUT.write_text(json.dumps(result.model_dump(), ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nCoverage {result.coverage}% · {len(result.blockers)} blockers · {result.verdict}")
    for f in result.findings:
        print(f"  {f.status:<10} {'*' if f.critical else ' '} {f.title}: {f.value}")
    print(f"\nSaved to {OUT}")


if __name__ == "__main__":
    asyncio.run(main())
