"""Small TTL cache: in memory, mirrored to disk so demo reruns survive a restart."""
from __future__ import annotations

import hashlib
import json
import time
from typing import Any

from .config import get_settings

_memory: dict[str, tuple[float, Any]] = {}


def make_key(*parts: Any) -> str:
    raw = json.dumps(parts, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def get(namespace: str, key: str, ttl: int | None = None) -> Any | None:
    settings = get_settings()
    ttl = settings.cache_ttl_seconds if ttl is None else ttl
    full = f"{namespace}:{key}"
    hit = _memory.get(full)
    now = time.time()
    if hit and now - hit[0] < ttl:
        return hit[1]
    path = settings.cache_dir / namespace / f"{key}.json"
    if path.exists():
        try:
            stored = json.loads(path.read_text(encoding="utf-8"))
            if now - stored["t"] < ttl:
                _memory[full] = (stored["t"], stored["v"])
                return stored["v"]
        except (OSError, ValueError, KeyError):
            pass
    return None


def put(namespace: str, key: str, value: Any) -> None:
    settings = get_settings()
    now = time.time()
    _memory[f"{namespace}:{key}"] = (now, value)
    try:
        folder = settings.cache_dir / namespace
        folder.mkdir(parents=True, exist_ok=True)
        (folder / f"{key}.json").write_text(json.dumps({"t": now, "v": value}, ensure_ascii=False), encoding="utf-8")
    except OSError:
        pass


def clear_memory() -> None:
    _memory.clear()
