"""Market data ingestion. Alpha Vantage covers EOD prices, commodities, treasury
yields, FX and crypto. Polygon.io covers intraday bars, trades and quotes needed
for microstructure signals (VWAP, OFI, dark pool proxy) — availability depends on
the Polygon plan tier, so every call here degrades to an empty DataFrame on a
403/paid-tier error instead of crashing the pipeline.
"""

from __future__ import annotations

import time

import pandas as pd
import requests

import config
from src.ingestion import cache

# Polygon's free tier caps at 5 req/min. A per-process sleep-based throttle keeps
# the pipeline from burning the whole budget on the first asset it processes.
_POLYGON_MIN_INTERVAL_SECONDS = 12.5
_last_polygon_call_at = 0.0

AV_CACHE_TTL_SECONDS = 12 * 3600  # EOD data is static until the next close
POLYGON_CACHE_TTL_SECONDS = 5 * 60

AV_COMMODITY_FUNCTIONS = {
    "wti": "WTI",
    "brent": "BRENT",
    "natural_gas": "NATURAL_GAS",
    "copper": "COPPER",
    "aluminum": "ALUMINUM",
    "wheat": "WHEAT",
    "corn": "CORN",
    "cotton": "COTTON",
    "sugar": "SUGAR",
    "coffee": "COFFEE",
    "all_commodities": "ALL_COMMODITIES",
}


def _av_get(params: dict) -> dict:
    cache_key = ("av", tuple(sorted(params.items())))
    cached = cache.read(cache_key, AV_CACHE_TTL_SECONDS)
    if cached is not None:
        return cached

    query = {**params, "apikey": config.ALPHA_VANTAGE_API_KEY}
    try:
        resp = requests.get(config.ALPHA_VANTAGE_BASE_URL, params=query, timeout=20)
        resp.raise_for_status()
        result = resp.json()
    except requests.exceptions.RequestException:
        return {}  # network hiccup — treat as no data, don't crash the pipeline

    if "Information" in result or "Note" in result:
        return {}  # rate-limit / quota exceeded — don't cache a failure as if it were real data

    cache.write(cache_key, result)
    return result


def get_daily_prices(symbol: str, outputsize: str = "compact") -> pd.DataFrame:
    data = _av_get(
        {
            "function": "TIME_SERIES_DAILY",
            "symbol": symbol,
            "outputsize": outputsize,
        }
    )
    series = data.get("Time Series (Daily)", {})
    if not series:
        return pd.DataFrame()

    df = pd.DataFrame.from_dict(series, orient="index", dtype=float)
    df.columns = ["open", "high", "low", "close", "volume"]
    df.index = pd.to_datetime(df.index)
    df = df.sort_index()
    return df


def get_commodity_series(commodity: str, interval: str = "monthly") -> pd.DataFrame:
    function = AV_COMMODITY_FUNCTIONS.get(commodity.lower())
    if function is None:
        raise ValueError(f"Unknown commodity '{commodity}'. Options: {list(AV_COMMODITY_FUNCTIONS)}")

    data = _av_get({"function": function, "interval": interval})
    values = data.get("data", [])
    if not values:
        return pd.DataFrame()

    df = pd.DataFrame(values)
    df["date"] = pd.to_datetime(df["date"])
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    df = df.dropna().set_index("date").sort_index()
    return df


def get_treasury_yield(maturity: str = "10year", interval: str = "daily") -> pd.DataFrame:
    data = _av_get(
        {
            "function": "TREASURY_YIELD",
            "interval": interval,
            "maturity": maturity,
        }
    )
    values = data.get("data", [])
    if not values:
        return pd.DataFrame()

    df = pd.DataFrame(values)
    df["date"] = pd.to_datetime(df["date"])
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    df = df.dropna().set_index("date").sort_index()
    return df


def get_fx_daily(from_symbol: str, to_symbol: str) -> pd.DataFrame:
    data = _av_get(
        {
            "function": "FX_DAILY",
            "from_symbol": from_symbol,
            "to_symbol": to_symbol,
        }
    )
    series = data.get("Time Series FX (Daily)", {})
    if not series:
        return pd.DataFrame()

    df = pd.DataFrame.from_dict(series, orient="index", dtype=float)
    df.columns = ["open", "high", "low", "close"]
    df.index = pd.to_datetime(df.index)
    return df.sort_index()


def get_crypto_daily(symbol: str, market: str = "USD") -> pd.DataFrame:
    data = _av_get(
        {
            "function": "DIGITAL_CURRENCY_DAILY",
            "symbol": symbol,
            "market": market,
        }
    )
    series = data.get("Time Series (Digital Currency Daily)", {})
    if not series:
        return pd.DataFrame()

    df = pd.DataFrame.from_dict(series, orient="index", dtype=float)
    df = df.rename(columns=lambda c: c.split(". ")[-1])
    df.index = pd.to_datetime(df.index)
    return df.sort_index()


def _polygon_get(path: str, params: dict | None = None) -> dict | None:
    if not config.POLYGON_API_KEY:
        return None

    cache_key = ("polygon", path, tuple(sorted((params or {}).items())))
    cached = cache.read(cache_key, POLYGON_CACHE_TTL_SECONDS)
    if cached is not None:
        return cached

    global _last_polygon_call_at
    elapsed = time.monotonic() - _last_polygon_call_at
    if elapsed < _POLYGON_MIN_INTERVAL_SECONDS:
        time.sleep(_POLYGON_MIN_INTERVAL_SECONDS - elapsed)

    params = {**(params or {}), "apiKey": config.POLYGON_API_KEY}
    try:
        resp = requests.get(f"{config.POLYGON_BASE_URL}{path}", params=params, timeout=20)
    except requests.exceptions.RequestException:
        return None  # network hiccup — treat as no data, don't crash the pipeline
    finally:
        _last_polygon_call_at = time.monotonic()

    if resp.status_code in (401, 403, 429):
        return None  # plan tier doesn't include this endpoint, or free-tier rate limit hit
    resp.raise_for_status()
    result = resp.json()
    cache.write(cache_key, result)
    return result


def get_intraday_aggregates(
    symbol: str, from_date: str, to_date: str, multiplier: int = 1, timespan: str = "minute"
) -> pd.DataFrame:
    data = _polygon_get(
        f"/v2/aggs/ticker/{symbol}/range/{multiplier}/{timespan}/{from_date}/{to_date}",
        {"adjusted": "true", "sort": "asc", "limit": 50000},
    )
    if not data or not data.get("results"):
        return pd.DataFrame()

    df = pd.DataFrame(data["results"])
    df = df.rename(
        columns={"o": "open", "h": "high", "l": "low", "c": "close", "v": "volume", "vw": "vwap", "t": "timestamp"}
    )
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
    return df.set_index("timestamp")


def get_trades(symbol: str, date: str, limit: int = 5000) -> pd.DataFrame:
    """Raw tape for the given trading day. Used by the dark pool proxy to flag
    trades reported through a Trade Reporting Facility (off-exchange / dark pool)."""
    data = _polygon_get(f"/v3/trades/{symbol}", {"timestamp": date, "limit": limit})
    if not data or not data.get("results"):
        return pd.DataFrame()

    df = pd.DataFrame(data["results"])
    if "participant_timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["participant_timestamp"], unit="ns")
    return df


def get_quotes(symbol: str, date: str, limit: int = 5000) -> pd.DataFrame:
    """NBBO quotes tape. Used to compute Order Flow Imbalance from bid/ask size changes."""
    data = _polygon_get(f"/v3/quotes/{symbol}", {"timestamp": date, "limit": limit})
    if not data or not data.get("results"):
        return pd.DataFrame()

    df = pd.DataFrame(data["results"])
    if "participant_timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["participant_timestamp"], unit="ns")
    return df


def get_options_snapshot(underlying_symbol: str) -> pd.DataFrame:
    """Options chain snapshot (strike, IV, OI, greeks) — needs a Polygon options
    add-on. Returns empty DataFrame if the plan doesn't include it, so GEX/vol-skew
    signals fall back to their proxy implementation."""
    data = _polygon_get(f"/v3/snapshot/options/{underlying_symbol}", {"limit": 250})
    if not data or not data.get("results"):
        return pd.DataFrame()

    rows = []
    for item in data["results"]:
        details = item.get("details", {})
        greeks = item.get("greeks", {})
        day = item.get("day", {})
        rows.append(
            {
                "contract": details.get("ticker"),
                "strike": details.get("strike_price"),
                "expiration": details.get("expiration_date"),
                "type": details.get("contract_type"),
                "open_interest": item.get("open_interest"),
                "implied_volatility": item.get("implied_volatility"),
                "delta": greeks.get("delta"),
                "gamma": greeks.get("gamma"),
                "volume": day.get("volume"),
            }
        )
    return pd.DataFrame(rows)
