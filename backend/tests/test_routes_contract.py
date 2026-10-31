"""Guards the public API: the routes the frontend calls must not change by accident (e.g. during refactors)."""
from app.main import app

EXPECTED = {
    ("GET", "/health"), ("GET", "/sample"),
    ("POST", "/analyze"), ("GET", "/analyze/{investigation_id}"), ("GET", "/analyze/{investigation_id}/events"),
    ("POST", "/analyze/{investigation_id}/cancel"),
    ("POST", "/email"), ("POST", "/translate"), ("POST", "/translate/report"),
    ("GET", "/traplab"), ("POST", "/traplab/update"), ("GET", "/traplab/page/{site}/{slug}"),
}


def test_route_table_is_unchanged():
    actual = {(m, r.path) for r in app.routes if hasattr(r, "methods") for m in r.methods if m not in {"HEAD", "OPTIONS"}}
    api_routes = {x for x in actual if not x[1].startswith(("/docs", "/redoc", "/openapi"))}
    assert api_routes == EXPECTED


def test_every_route_is_tagged_for_the_docs():
    tagged = [r for r in app.routes if hasattr(r, "tags") and r.path in {p for _, p in EXPECTED}]
    assert tagged and all(r.tags for r in tagged)
