"""The bundled sample case (illustrative data). The frontend ships an identical copy; a test keeps them in sync."""
from __future__ import annotations

import asyncio
from pathlib import Path

from .. import jobs
from ..models import InvestigationResult, PipelineEvent

SAMPLE_PATH = Path(__file__).resolve().parent.parent / "samples" / "scholarship.json"

_DEMO_STEPS = [
    ("checklist", 12, "Checklist ready (sample)."), ("fetch", 25, "Read 4 of 5 sources (sample)."),
    ("classify", 32, "Checked who is speaking (sample)."), ("extract", 55, "Read every source (sample)."),
    ("verify", 65, "Matched quotes against page text (sample)."), ("compare", 78, "Compared by authority and context (sample)."),
    ("score", 85, "Coverage 67% · 3 decision blockers (sample)."), ("actions", 95, "4 things to verify next (sample)."),
]


def load_sample() -> InvestigationResult:
    return InvestigationResult.model_validate_json(SAMPLE_PATH.read_text(encoding="utf-8"))


async def run_demo_job(job: jobs.Job) -> None:
    """With no AI key configured, replay the pipeline steps and finish with the sample case (clearly labelled as sample)."""
    for step, progress, message in _DEMO_STEPS:
        await asyncio.sleep(0.45)
        await job.emit(PipelineEvent(step=step, progress=progress, message=message))
    job.result = load_sample().model_copy(update={"investigation_id": job.id})
    await job.emit(PipelineEvent(step="done", progress=100, message="Sample case ready.", detail={"investigation_id": job.id, "mode": "demo"}))
    job.done.set()
