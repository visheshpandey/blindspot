"""Trap Lab: five invented test pages with planted traps (see app/traplab.py)."""
from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from .. import traplab
from ..errors import error

router = APIRouter(tags=["trap lab"])


@router.get("/traplab")
async def traplab_info() -> dict:
    """The Trap Lab case: question, context, the five test-page URLs and the traps planted in them."""
    return {"question": traplab.QUESTION, "year": "2026–27", "location": "Madhya Pradesh", "category": "Undergraduate student",
            "sources": traplab.URLS, "traps": traplab.TRAPS}


@router.post("/traplab/update")
async def traplab_update(updated: bool = True) -> dict:
    """Demo simulation: the official notice changes its deadline (labelled as a simulation in the UI)."""
    traplab.STATE["updated"] = updated
    return {"updated": updated}


@router.get("/traplab/page/{site}/{slug}", response_class=HTMLResponse)
async def traplab_page(site: str, slug: str):
    """Lets people open a Trap Lab page in the browser (the .example hosts don't exist on the internet)."""
    html = traplab.page_html(f"{site}.{traplab.DOMAIN}", f"/{slug}")
    if html is None:
        return error(404, "not_found", "No such Trap Lab page.")
    return HTMLResponse(html)
