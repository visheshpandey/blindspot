"""Run the three demo investigations against the live API and save them for Demo mode.

Usage (backend running on :8000 with a working AI key):
    .venv/Scripts/python -m scripts.demo_cases
Writes frontend/src/data/demo-cases.json. These are real runs on real public pages, kept so a demo works offline.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import httpx

OUT = Path(__file__).resolve().parents[2] / "frontend" / "src" / "data" / "demo-cases.json"
CASES = [
    {"topic": "Scholarship", "question": "What should I verify before applying for the post-matric scholarship?",
     "year": "2026–27", "location": "Madhya Pradesh", "category": "Undergraduate student",
     "sources": ["https://scholarships.gov.in/", "https://socialjustice.gov.in/schemes/25", "https://en.wikipedia.org/wiki/Post_Matric_Scholarship_for_Scheduled_Castes"]},
    {"topic": "University admission", "question": "What are the eligibility rules and documents for this university admission?",
     "year": "2026–27", "location": "Delhi", "category": "Undergraduate student",
     "sources": ["https://cuet.nta.nic.in/", "https://www.du.ac.in/", "https://www.ugc.gov.in/"]},
    {"topic": "Internship offer", "question": "What should I check before accepting this internship offer?",
     "year": "2026–27", "location": "India-wide", "category": "Undergraduate student",
     "sources": ["https://internship.aicte-india.org/", "https://ncs.gov.in/", "https://www.mygov.in/"]},
]


def run(client: httpx.Client, case: dict) -> dict:
    body = {k: v for k, v in case.items() if k != "topic"}
    iid = client.post("/analyze", json=body).raise_for_status().json()["investigation_id"]
    with client.stream("GET", f"/analyze/{iid}/events") as stream:
        for line in stream.iter_lines():
            if line.startswith("data: ") and json.loads(line[6:])["step"] in ("done", "error"):
                break
    result = client.get(f"/analyze/{iid}").raise_for_status().json()
    result["demo_run"] = True
    result["demo_topic"] = case["topic"]
    return result


def main() -> None:
    client = httpx.Client(base_url="http://localhost:8000", timeout=300)
    results = []
    for case in CASES:
        t = time.time()
        r = run(client, case)
        print(f"{case['topic']:22} {r['verdict']:22} coverage {r['coverage']}%  {len(r['findings'])} findings  warnings={len(r['warnings'])}  {time.time() - t:.0f}s")
        results.append(r)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Saved {len(results)} cases to {OUT}")


if __name__ == "__main__":
    main()
