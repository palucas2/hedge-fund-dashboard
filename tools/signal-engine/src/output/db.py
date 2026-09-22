"""Postgres connection shared by the alerts and trades writers.

Two failure modes, two remedies:

1. A single dropped connection (Neon waking a suspended compute, a flaky network) used
   to fail the whole daemon cycle after all the API quota had already been spent
   computing the ideas. `connect_with_retry` covers that with a few short retries.

2. On some networks (seen here: a VPN/firewall that lets the TCP handshake on 5432
   through but silently drops everything after — confirmed with a raw socket: connect
   succeeds, the Postgres SSLRequest response never arrives, even outside Claude
   Code's own sandbox) the direct connection just hangs. libpq's `connect_timeout`
   does not cover this phase, so it can hang well past it. Port 443 to the same host
   was open, and Neon's HTTP SQL endpoint (the one its serverless driver uses) answered
   normally, so `get_connection()` bounds the TCP attempt with a real wall-clock
   timeout and falls back to that endpoint when it doesn't return in time.

The HTTP fallback is not a drop-in transaction: each statement commits as its own
HTTP request, so `with conn:` around several statements no longer rolls all of them
back together if a later one fails (each already-executed statement stays committed).
Acceptable for this daemon (idempotent, deduped inserts) but worth knowing before
reusing this fallback somewhere transactional correctness actually matters.
"""

from __future__ import annotations

import queue
import re
import threading
from urllib.parse import urlsplit

import psycopg2
import requests

import config

CONNECT_TIMEOUT_SECONDS = 10
CONNECT_ATTEMPTS = 3
BACKOFF_SECONDS = 2.0
# Real wall-clock budget for the whole (possibly-retried) TCP attempt before
# falling back to HTTP — covers the case connect_timeout doesn't (hangs after
# the TCP handshake, during the SSL/protocol negotiation).
TCP_BUDGET_SECONDS = 15


def connect_with_retry(
    database_url: str,
    attempts: int = CONNECT_ATTEMPTS,
    backoff_seconds: float = BACKOFF_SECONDS,
    connect=psycopg2.connect,
    sleep=__import__("time").sleep,
):
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            return connect(database_url, connect_timeout=CONNECT_TIMEOUT_SECONDS)
        except Exception as error:
            last_error = error
            if attempt < attempts - 1:
                sleep(backoff_seconds * 2**attempt)
    raise last_error


def _connect_tcp_bounded(database_url: str):
    # A plain (non-daemon) thread would keep the whole process alive at exit until
    # a truly stuck connect() call finally resolves (an earlier version of this used
    # ThreadPoolExecutor, whose worker threads aren't daemons — hung the daemon
    # process itself on shutdown, on top of hanging every retry loop). daemon=True
    # lets a stuck attempt leak in the background without blocking anything else.
    outcome: queue.Queue = queue.Queue(maxsize=1)

    def attempt() -> None:
        try:
            outcome.put(("ok", connect_with_retry(database_url)))
        except Exception as error:
            outcome.put(("error", error))

    threading.Thread(target=attempt, daemon=True).start()
    try:
        status, value = outcome.get(timeout=TCP_BUDGET_SECONDS)
    except queue.Empty:
        raise TimeoutError(f"no TCP connection to Postgres within {TCP_BUDGET_SECONDS}s")
    if status == "error":
        raise value
    return value


def get_connection():
    if not config.DATABASE_URL:
        raise RuntimeError("DATABASE_URL not set — see .env.example")
    try:
        return _connect_tcp_bounded(config.DATABASE_URL)
    except Exception:
        return NeonHttpConnection(config.DATABASE_URL)


# --- HTTP fallback -----------------------------------------------------------------

_PLACEHOLDER = re.compile(r"%s")


def _to_positional(sql: str) -> str:
    """psycopg2-style '%s' placeholders, in order, to Postgres '$1', '$2', ... —
    the HTTP endpoint binds real positional parameters server-side, so (unlike
    psycopg2's client-side mogrify) a placeholder can't sit inside a string literal;
    callers needing a value baked into one (e.g. an INTERVAL) must format it in
    Python instead of passing it as a bound param."""
    counter = iter(range(1, 1000))
    return _PLACEHOLDER.sub(lambda _: f"${next(counter)}", sql)


class NeonHttpCursor:
    def __init__(self, connection_string: str, host: str):
        self._connection_string = connection_string
        self._url = f"https://{host}/sql"
        self._last_rows: list[tuple] = []

    def execute(self, sql: str, params: tuple = ()) -> None:
        response = requests.post(
            self._url,
            headers={
                "Content-Type": "application/json",
                "Neon-Connection-String": self._connection_string,
            },
            json={"query": _to_positional(sql), "params": list(params)},
            timeout=15,
        )
        response.raise_for_status()
        payload = response.json()
        columns = [field["name"] for field in payload.get("fields", [])]
        self._last_rows = [tuple(row[c] for c in columns) for row in payload.get("rows", [])]

    def fetchone(self):
        return self._last_rows[0] if self._last_rows else None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False


class NeonHttpConnection:
    def __init__(self, database_url: str):
        self._database_url = database_url
        self._host = urlsplit(database_url.replace("postgresql://", "https://", 1)).hostname

    def cursor(self) -> NeonHttpCursor:
        return NeonHttpCursor(self._database_url, self._host)

    def close(self) -> None:
        pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False
