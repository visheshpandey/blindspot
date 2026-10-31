"""Blindspot API entry point: builds the app, CORS, error handling and mounts the routers in app/api.

Run: uvicorn app.main:app --port 8000   (settings come from backend/.env, see app/config.py)
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import routers
from .config import get_settings
from .errors import register_error_handlers

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("blindspot")


def create_app() -> FastAPI:
    settings = get_settings()
    api = FastAPI(title="Blindspot API", version="1.0.0", description="Don't just collect information. Investigate it.")
    api.add_middleware(CORSMiddleware, allow_origins=settings.origins, allow_methods=["*"], allow_headers=["*"])
    register_error_handlers(api)
    for router in routers:
        api.include_router(router)
    log.info("AI provider: %s · allowed origins: %s", settings.llm_provider, ", ".join(settings.origins) or "none")
    return api


app = create_app()
