"""A small in-memory rate limit: at most RATE_LIMIT investigations per client IP per RATE_WINDOW seconds."""
from __future__ import annotations

import time
from collections import defaultdict, deque

RATE_LIMIT = 10          # investigations
RATE_WINDOW = 60.0       # seconds, per client IP
recent: dict[str, deque] = defaultdict(deque)


def rate_limited(ip: str) -> bool:
    """Records a hit for `ip` and returns True when it is over the limit (the hit is not recorded then)."""
    now = time.monotonic()
    hits = recent[ip]
    while hits and now - hits[0] > RATE_WINDOW:
        hits.popleft()
    if len(hits) >= RATE_LIMIT:
        return True
    hits.append(now)
    return False
