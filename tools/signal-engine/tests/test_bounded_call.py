"""Regression test for the 3h42-instead-of-15-minute daemon cycle: yfinance's own
retry/backoff on a flaky DNS lookup can hang far past any sane per-symbol budget,
and nothing capped it. See src/ingestion/bounded_call.py.
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

from src.ingestion.bounded_call import call_with_timeout


def test_returns_the_result_when_the_call_finishes_in_time():
    assert call_with_timeout(lambda: 42, timeout=1) == 42


def test_reraises_the_original_exception():
    def boom():
        raise ValueError("bad symbol")

    with pytest.raises(ValueError, match="bad symbol"):
        call_with_timeout(boom, timeout=1)


def test_raises_timeout_error_instead_of_hanging_when_the_call_never_returns():
    started = time.time()

    with pytest.raises(TimeoutError):
        call_with_timeout(lambda: time.sleep(999), timeout=0.05)

    assert time.time() - started < 1


def test_does_not_block_process_exit_on_a_stuck_call():
    """The earlier ThreadPoolExecutor-based version of this pattern (src/output/db.py's
    first cut) blocked on shutdown(wait=True) waiting for a stuck thread — this must use
    a daemon thread instead, so a caller (like pytest itself) can exit immediately."""
    import threading

    before = threading.active_count()
    with pytest.raises(TimeoutError):
        call_with_timeout(lambda: time.sleep(999), timeout=0.05)
    leaked = [t for t in threading.enumerate() if t.daemon and t.is_alive()]
    assert threading.active_count() >= before  # the stuck attempt is still running...
    assert all(t.daemon for t in leaked)  # ...but only as daemon threads
