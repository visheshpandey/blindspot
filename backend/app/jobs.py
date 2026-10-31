"""In-memory job store. Each job keeps its event log so SSE clients can join late or reconnect."""
from __future__ import annotations

import asyncio
import logging
import secrets
from collections import OrderedDict
from dataclasses import dataclass, field

from .models import AnalyzeRequest, InvestigationResult, PipelineEvent
from .pipeline import run_pipeline

log = logging.getLogger("blindspot.jobs")
MAX_JOBS = 50


@dataclass
class Job:
    id: str
    events: list[PipelineEvent] = field(default_factory=list)
    result: InvestigationResult | None = None
    error: str = ""
    done: asyncio.Event = field(default_factory=asyncio.Event)
    task: asyncio.Task | None = None
    changed: asyncio.Condition = field(default_factory=asyncio.Condition)

    async def emit(self, event: PipelineEvent) -> None:
        async with self.changed:
            self.events.append(event)
            self.changed.notify_all()


jobs: "OrderedDict[str, Job]" = OrderedDict()


def new_id() -> str:
    """Unguessable case id: 'INV-' + 10 url-safe random characters."""
    return f"INV-{secrets.token_urlsafe(8)[:10]}"


def create(req: AnalyzeRequest) -> Job:
    job = Job(id=new_id())
    jobs[job.id] = job
    while len(jobs) > MAX_JOBS:
        jobs.popitem(last=False)
    job.task = asyncio.create_task(_run(job, req))
    return job


async def _run(job: Job, req: AnalyzeRequest) -> None:
    try:
        job.result = await run_pipeline(req, job.id, job.emit)
        await job.emit(PipelineEvent(step="done", progress=100, message="Case closed. Report ready.", detail={"investigation_id": job.id}))
    except Exception:  # noqa: BLE001 - any failure becomes a friendly event, never a raw traceback
        log.exception("Pipeline failed for %s", job.id)
        job.error = "Something went wrong while investigating. Try again, or open the sample case."
        await job.emit(PipelineEvent(step="error", progress=100, message=job.error))
    finally:
        job.done.set()
