"""Runs the Trap Lab case through the live API and prints what each trap produced.

Usage: .venv/Scripts/python -m scripts.trap_run [--save]   (backend on :8000 with a working AI key)
--save writes the result to frontend/src/data/traplab-run.json, the recorded run used by Demo mode.
"""
import json
import sys
import time
from pathlib import Path

import httpx

API = "http://localhost:8000"
OUT = Path(__file__).resolve().parents[2] / "frontend" / "src" / "data" / "traplab-run.json"


def main() -> None:
    info = httpx.get(f"{API}/traplab").json()
    body = {k: info[k] for k in ("question", "year", "location", "category", "sources")}
    started = time.time()
    case_id = httpx.post(f"{API}/analyze", json=body).json()["investigation_id"]
    while True:
        r = httpx.get(f"{API}/analyze/{case_id}")
        if r.status_code == 200:
            result = r.json()
            break
        if time.time() - started > 240:
            sys.exit("timed out")
        time.sleep(2)
    print(f"{case_id} in {time.time() - started:.0f}s · {result['verdict']} · {result['coverage']}% · warnings: {result['warnings']}")
    for s in result["sources"]:
        print(f"  {s['id']} {s['type']:<13} {s['state']:<9} {s['name'][:70]}")
    for f in result["findings"]:
        print(f"  [{f['status']:<10}] {'*' if f['critical'] else ' '} {f['title'][:40]:<40} {f['value'][:70]}")
    print("  DNA clusters:", result.get("source_dna", {}).get("clusters"))
    if "--save" in sys.argv:
        result["demo_run"] = True
        result["demo_topic"] = "Trap Lab"
        result["traplab"] = True
        OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
        print("saved", OUT)


if __name__ == "__main__":
    main()
