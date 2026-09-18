"""Disk-backed response cache. Alpha Vantage's free tier caps at 25 requests/day
total across every function — trivially exhausted by a handful of pipeline runs
since each unique symbol costs a call. EOD data doesn't change until the next
close, so a multi-hour TTL turns repeat lookups within a day into free hits
instead of burning quota. News endpoints use a much shorter TTL since freshness
is the point, mainly to survive repeated calls during iterative testing.

Callers are expected to only write successful payloads — a rate-limit/error
response should never get cached, or it'd keep masquerading as "no data" long
after the underlying limit resets.
"""

from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path

CACHE_DIR = Path(__file__).resolve().parent.parent.parent / ".cache"
CACHE_DIR.mkdir(exist_ok=True)


def _path_for(key_parts: tuple) -> Path:
    key = hashlib.sha1("|".join(str(p) for p in key_parts).encode()).hexdigest()
    return CACHE_DIR / f"{key}.json"


def read(key_parts: tuple, ttl_seconds: int) -> dict | None:
    path = _path_for(key_parts)
    if not path.exists():
        return None
    if time.time() - path.stat().st_mtime >= ttl_seconds:
        return None
    try:
        return json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return None


def write(key_parts: tuple, value: dict) -> None:
    path = _path_for(key_parts)
    try:
        path.write_text(json.dumps(value))
    except (TypeError, OSError):
        pass  # unserializable or disk issue — caller still has the live result
