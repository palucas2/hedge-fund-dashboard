"""Regression tests for the data-quality fixes found while validating the daemon end to end:

- yfinance returns junk implied vols (~1e-5) when quotes are stale; signals used to
  treat them as real data (gex/vrp/vol_skew reported is_mocked=False on garbage);
- vol_skew looked at the nearest expiry only (0-3 days for SPY), where a 25-delta
  skew is meaningless;
- FX / commodity / bond / crypto symbols were sent to yfinance's options endpoint
  (EURUSD, NATURAL_GAS -> 404s);
- one dropped Postgres connection killed a whole daemon cycle;
- some networks block the Postgres wire protocol on 5432 outright (TCP connects,
  then hangs forever) — the HTTP fallback to Neon's SQL-over-HTTPS endpoint covers
  that, but needs '%s' placeholders translated to positional '$1'/'$2'/... ones.
"""

import sys
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd
import pytest

from src.ingestion import options_data
from src.ingestion.expirations import pick_skew_expiration, select_expirations
from src.models.schemas import AssetClass
from src.output.db import NeonHttpConnection, connect_with_retry, _to_positional
from src.pipeline import options_supported
from src.signals import vol_skew

TODAY = date(2026, 9, 21)


def _daily_expirations(n: int) -> list[str]:
    return [(TODAY + timedelta(days=i)).isoformat() for i in range(1, n + 1)]


# --- expiration selection ---------------------------------------------------------

def test_pick_skew_expiration_targets_30_days_and_ignores_the_very_short_dated():
    expirations = _daily_expirations(60)
    assert pick_skew_expiration(expirations, TODAY) == (TODAY + timedelta(days=30)).isoformat()


def test_pick_skew_expiration_returns_none_when_everything_expires_within_a_week():
    assert pick_skew_expiration(_daily_expirations(5), TODAY) is None


def test_select_expirations_keeps_the_near_ones_and_adds_the_skew_tenor_once():
    expirations = _daily_expirations(60)
    picked = select_expirations(expirations, TODAY, max_near=4)
    assert picked[:4] == expirations[:4]
    assert (TODAY + timedelta(days=30)).isoformat() in picked
    assert len(picked) == len(set(picked)) == 5


def test_select_expirations_does_not_duplicate_when_skew_tenor_is_already_near():
    expirations = [(TODAY + timedelta(days=d)).isoformat() for d in (10, 20, 30, 40)]
    assert select_expirations(expirations, TODAY, max_near=4) == expirations


def test_select_expirations_handles_no_expirations():
    assert select_expirations([], TODAY, max_near=4) == []


# --- junk implied vols ------------------------------------------------------------

class _FakeChain:
    def __init__(self, calls: pd.DataFrame, puts: pd.DataFrame):
        self.calls, self.puts = calls, puts


class _FakeTicker:
    def __init__(self, expiry: str):
        self.options = (expiry,)
        self._expiry = expiry

    def history(self, period="1d"):
        return pd.DataFrame({"Close": [100.0]})

    def option_chain(self, expiry):
        rows = pd.DataFrame(
            {
                "contractSymbol": ["good", "junk", "nan"],
                "strike": [100.0, 100.0, 100.0],
                "impliedVolatility": [0.20, 0.00001, float("nan")],
                "openInterest": [10, 10, 10],
                "volume": [1, 1, 1],
            }
        )
        return _FakeChain(rows, rows)


def test_options_snapshot_drops_junk_and_missing_implied_vols(monkeypatch):
    expiry = (datetime.now().date() + timedelta(days=30)).isoformat()
    monkeypatch.setattr(options_data.yf, "Ticker", lambda symbol: _FakeTicker(expiry))

    snapshot = options_data.get_yfinance_options_snapshot("SPY", spot_price=100.0)

    assert set(snapshot["contract"]) == {"good"}
    assert (snapshot["implied_volatility"] >= options_data.MIN_VALID_IV).all()


# --- vol_skew tenor ---------------------------------------------------------------

def _options_rows(expiry: str, put_iv: float, call_iv: float) -> list[dict]:
    return [
        {"expiration": expiry, "type": "put", "delta": -0.25, "implied_volatility": put_iv},
        {"expiration": expiry, "type": "call", "delta": 0.25, "implied_volatility": call_iv},
    ]


def test_vol_skew_uses_the_30_day_expiry_not_the_nearest():
    near = (date.today() + timedelta(days=1)).isoformat()
    tenor = (date.today() + timedelta(days=30)).isoformat()
    df = pd.DataFrame(_options_rows(near, 0.90, 0.10) + _options_rows(tenor, 0.30, 0.20))

    result = vol_skew.compute("SPY", df)

    assert result.is_mocked is False
    assert result.value["expiration"] == tenor
    assert result.value["skew_25d"] == pytest.approx(0.10)
    assert result.direction == "bearish"


def test_vol_skew_is_mocked_when_only_very_short_dated_expiries_exist():
    near = (date.today() + timedelta(days=2)).isoformat()
    df = pd.DataFrame(_options_rows(near, 0.30, 0.20))

    assert vol_skew.compute("SPY", df).is_mocked is True


# --- asset classes that have no options chain -------------------------------------

@pytest.mark.parametrize("asset_class", [AssetClass.STOCK, AssetClass.ETF])
def test_options_are_fetched_for_equities_and_etfs(asset_class):
    assert options_supported(asset_class) is True


@pytest.mark.parametrize("asset_class", [AssetClass.FX, AssetClass.COMMODITY, AssetClass.BOND, AssetClass.CRYPTO])
def test_options_are_not_fetched_for_other_asset_classes(asset_class):
    assert options_supported(asset_class) is False


# --- database connection retry ----------------------------------------------------

def test_connect_with_retry_recovers_from_transient_failures():
    calls = []

    def flaky_connect(url, connect_timeout):
        calls.append(url)
        if len(calls) < 3:
            raise ConnectionError("timeout expired")
        return "connection"

    sleeps = []
    result = connect_with_retry("postgres://x", attempts=3, backoff_seconds=2.0, connect=flaky_connect, sleep=sleeps.append)

    assert result == "connection"
    assert len(calls) == 3
    assert sleeps == [2.0, 4.0]


def test_connect_with_retry_raises_the_last_error_after_all_attempts():
    def always_down(url, connect_timeout):
        raise ConnectionError("timeout expired")

    with pytest.raises(ConnectionError, match="timeout expired"):
        connect_with_retry("postgres://x", attempts=2, backoff_seconds=0, connect=always_down, sleep=lambda s: None)


# --- HTTP fallback when the Postgres wire protocol is blocked ---------------------

def test_to_positional_translates_placeholders_in_order():
    assert _to_positional("WHERE a = %s AND b = %s") == "WHERE a = $1 AND b = $2"


def test_to_positional_leaves_a_query_with_no_placeholders_untouched():
    assert _to_positional("SELECT 1") == "SELECT 1"


def test_neon_http_connection_derives_the_sql_endpoint_from_the_dsn():
    conn = NeonHttpConnection("postgresql://user:pw@my-host.neon.tech/db?sslmode=require")
    assert conn._host == "my-host.neon.tech"


def test_http_cursor_execute_posts_translated_query_and_positional_params(monkeypatch):
    captured = {}

    class _FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"fields": [{"name": "count"}], "rows": [{"count": 12}]}

    def fake_post(url, headers, json, timeout):
        captured["url"] = url
        captured["headers"] = headers
        captured["json"] = json
        return _FakeResponse()

    monkeypatch.setattr("src.output.db.requests.post", fake_post)

    conn = NeonHttpConnection("postgresql://user:pw@my-host.neon.tech/db")
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM alerts WHERE asset = %s", ("SPY",))
        row = cur.fetchone()

    assert row == (12,)
    assert captured["url"] == "https://my-host.neon.tech/sql"
    assert captured["json"]["query"] == "SELECT count(*) FROM alerts WHERE asset = $1"
    assert captured["json"]["params"] == ["SPY"]
    assert captured["headers"]["Neon-Connection-String"] == "postgresql://user:pw@my-host.neon.tech/db"


def test_get_connection_falls_back_to_http_when_tcp_never_returns(monkeypatch):
    import src.output.db as db_module

    def hangs_forever(*args, **kwargs):
        import time as _time

        _time.sleep(999)

    monkeypatch.setattr(db_module, "connect_with_retry", hangs_forever)
    monkeypatch.setattr(db_module, "TCP_BUDGET_SECONDS", 0.05)
    monkeypatch.setattr(db_module.config, "DATABASE_URL", "postgresql://user:pw@my-host.neon.tech/db")

    conn = db_module.get_connection()

    assert isinstance(conn, NeonHttpConnection)
