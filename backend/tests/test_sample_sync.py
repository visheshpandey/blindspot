import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_frontend_and_backend_samples_are_identical():
    backend = json.loads((ROOT / "backend/app/samples/scholarship.json").read_text(encoding="utf-8"))
    frontend = json.loads((ROOT / "frontend/src/data/sample.json").read_text(encoding="utf-8"))
    assert backend == frontend
