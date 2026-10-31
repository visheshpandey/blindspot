"""Investigations: start (POST /analyze), follow (SSE), fetch the result, cancel."""
import asyncio
import json

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from .. import jobs
from ..config import get_settings
from ..errors import error
from ..models import AnalyzeAccepted, AnalyzeRequest, InvestigationResult, PipelineEvent
from ..ratelimit import rate_limited
from ..services.samples import run_demo_job

router = APIRouter(tags=["investigations"])

NOT_FOUND = "That investigation was not found. It may have expired; please run it again."


@router.post("/analyze", response_model=AnalyzeAccepted, status_code=202)
async def analyze(req: AnalyzeRequest, request: Request):
    if rate_limited(request.client.host if request.client else "unknown"):
        return error(429, "rate_limited", "Too many investigations from this address. Please wait a minute and try again.")
    if get_settings().llm_provider == "none":
        job = jobs.Job(id=jobs.new_id())
        jobs.jobs[job.id] = job
        asyncio.create_task(run_demo_job(job))
        return AnalyzeAccepted(investigation_id=job.id)
    return AnalyzeAccepted(investigation_id=jobs.create(req).id)


@router.get("/analyze/{investigation_id}/events")
async def events(investigation_id: str, request: Request) -> StreamingResponse:
    job = jobs.jobs.get(investigation_id)
    if not job:
        return error(404, "not_found", NOT_FOUND)

    async def stream():
        sent = 0
        while True:
            while sent < len(job.events):
                yield f"data: {json.dumps(job.events[sent].model_dump(), ensure_ascii=False)}\n\n"
                sent += 1
            if job.done.is_set() and sent >= len(job.events):
                break
            if await request.is_disconnected():
                break
            async with job.changed:
                try:
                    await asyncio.wait_for(job.changed.wait(), timeout=15)
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/analyze/{investigation_id}", response_model=InvestigationResult)
async def result(investigation_id: str):
    job = jobs.jobs.get(investigation_id)
    if not job:
        return error(404, "not_found", NOT_FOUND)
    if job.error:
        return error(500, "pipeline_failed", job.error)
    if not job.result:
        return JSONResponse(status_code=202, content={"status": "running", "progress": job.events[-1].progress if job.events else 0})
    return job.result


@router.post("/analyze/{investigation_id}/cancel")
async def cancel(investigation_id: str):
    """Stops a running investigation (the user pressed Cancel)."""
    job = jobs.jobs.get(investigation_id)
    if not job:
        return error(404, "not_found", "That investigation was not found.")
    if job.task and not job.task.done():
        job.task.cancel()
        job.error = "Cancelled."
        await job.emit(PipelineEvent(step="error", progress=100, message="Investigation cancelled."))
        job.done.set()
    return {"status": "cancelled"}
