"""Runs the Trap Lab case several times with slightly different wording (so the 10-minute cache can't hide AI variance)
and prints which of the five traps were caught each time. Usage: python -m scripts.trap_variance [runs]"""
import sys
import time

import httpx

API = "http://localhost:8000"
VARIANTS = ["", " Please be specific.", " I am applying this year.", " Answer for a first-time applicant.", " Keep it practical."]


def caught(result: dict) -> dict:
    statuses = {f["status"] for f in result["findings"]}
    return {"conflict": "conflict" in statuses, "outdated": "outdated" in statuses, "gap": "missing" in statuses,
            "copied": bool(result.get("source_dna", {}).get("clusters")), "state": "unverified" in statuses}


def main() -> None:
    runs = int(sys.argv[1]) if len(sys.argv) > 1 else 4
    info = httpx.get(f"{API}/traplab").json()
    total = 0
    for i in range(runs):
        body = {k: info[k] for k in ("year", "location", "category", "sources")}
        body["question"] = info["question"] + VARIANTS[i % len(VARIANTS)]
        case = httpx.post(f"{API}/analyze", json=body).json()["investigation_id"]
        started = time.time()
        while True:
            r = httpx.get(f"{API}/analyze/{case}")
            if r.status_code == 200:
                break
            if time.time() - started > 200:
                sys.exit("timed out")
            time.sleep(2)
        c = caught(r.json())
        total += sum(c.values())
        print(f"run {i + 1}: {sum(c.values())}/5  missed={[k for k, v in c.items() if not v]}  ({time.time() - started:.0f}s)")
    print(f"average {total / runs:.1f}/5")


if __name__ == "__main__":
    main()
