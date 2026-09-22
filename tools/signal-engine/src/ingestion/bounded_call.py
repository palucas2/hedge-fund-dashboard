"""Bounds a call's wall-clock time.

Built for yfinance (curl_cffi under the hood): its own retry/backoff on a flaky DNS
lookup can run for minutes on a single symbol, and a daemon cycle touches dozens of
symbols — measured on this machine's network, one real cycle went from the intended
15 minutes to 3h42, chasing three symbols' failed Yahoo lookups alone. Same
daemon-thread-plus-queue pattern as src/output/db.py's Postgres connection fallback,
generalized: a stuck call leaks a background thread instead of hanging the caller.
"""

from __future__ import annotations

import queue
import threading
from typing import Callable, TypeVar

T = TypeVar("T")

DEFAULT_TIMEOUT_SECONDS = 15


def call_with_timeout(fn: Callable[[], T], timeout: float = DEFAULT_TIMEOUT_SECONDS) -> T:
    """Runs the zero-argument callable `fn` in a daemon thread. Returns its result if it
    completes within `timeout` seconds; re-raises whatever exception it raised; raises
    TimeoutError otherwise (fn keeps running in the background, unjoined)."""
    outcome: queue.Queue = queue.Queue(maxsize=1)

    def attempt() -> None:
        try:
            outcome.put(("ok", fn()))
        except Exception as error:
            outcome.put(("error", error))

    threading.Thread(target=attempt, daemon=True).start()
    try:
        status, value = outcome.get(timeout=timeout)
    except queue.Empty:
        raise TimeoutError(f"call did not return within {timeout}s")
    if status == "error":
        raise value
    return value
