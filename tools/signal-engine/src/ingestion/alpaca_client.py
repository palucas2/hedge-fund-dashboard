"""Alpaca's market data API — free (IEX feed) with just a paper-trading account,
no credit card. Needs ALPACA_API_KEY_ID/ALPACA_API_SECRET_KEY in .env; every
function here returns an empty DataFrame if those aren't set, same
degrade-gracefully contract as every other client in this package.

This exists because VWAP/OFI/dark-pool are the last three signals still stuck
on proxies — Polygon's free tier doesn't include intraday/quotes/trades, and
neither Alpha Vantage nor yfinance offer genuine tick-level data. Alpaca's free
tier does, for real-time and recent history.

Column shapes are made to match src/ingestion/market_data_client.py's Polygon
functions exactly (open/high/low/close/volume/vwap for bars; bid_price/
bid_size/ask_price/ask_size for quotes; price/size for trades) so vwap.py/
ofi.py/dark_pool.py accept this source unchanged — no signal module needed to
change to use it.

Caveat honestly noted: Alpaca's free tier is the IEX feed, one exchange among
~16 — real but partial volume/liquidity, not full consolidated tape (that's
the paid SIP feed, same tier boundary Polygon has). dark_pool.py specifically
needs trf_id (Trade Reporting Facility tagging) to detect genuine off-exchange
dark-pool prints, which IEX-only data doesn't carry — VWAP and OFI benefit
from this client, dark pool detection still falls back to its proxy even with
a free Alpaca key.

Verified live against a real free account: bars/quotes/trades all return real
data. One thing the docs don't make obvious — free accounts must pass
`feed=iex` explicitly, or every endpoint 403s ("subscription does not permit
querying recent SIP data"); Alpaca defaults to the paid SIP feed rather than
falling back to IEX automatically. Found by testing, not by reading.
"""

from __future__ import annotations

import pandas as pd
import requests

import config

ALPACA_DATA_BASE_URL = "https://data.alpaca.markets/v2"


def _headers() -> dict | None:
    if not config.ALPACA_API_KEY_ID or not config.ALPACA_API_SECRET_KEY:
        return None
    return {
        "APCA-API-KEY-ID": config.ALPACA_API_KEY_ID,
        "APCA-API-SECRET-KEY": config.ALPACA_API_SECRET_KEY,
    }


def _get(path: str, params: dict) -> dict | None:
    headers = _headers()
    if headers is None:
        return None
    # Free accounts are IEX-only — Alpaca defaults to the paid SIP feed if
    # `feed` isn't specified, which 403s ("subscription does not permit
    # querying recent SIP data") rather than falling back automatically.
    # Found by testing live against a real free account, not documented
    # clearly enough to have guessed right without one.
    params = {**params, "feed": "iex"}
    try:
        resp = requests.get(f"{ALPACA_DATA_BASE_URL}{path}", headers=headers, params=params, timeout=20)
        if resp.status_code in (401, 403, 429):
            return None
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException:
        return None


def get_intraday_bars(symbol: str, start_iso: str, end_iso: str, timeframe: str = "1Min") -> pd.DataFrame:
    data = _get(f"/stocks/{symbol}/bars", {"start": start_iso, "end": end_iso, "timeframe": timeframe, "limit": 10000})
    bars = (data or {}).get("bars", [])
    if not bars:
        return pd.DataFrame()

    df = pd.DataFrame(bars)
    df = df.rename(columns={"o": "open", "h": "high", "l": "low", "c": "close", "v": "volume", "vw": "vwap", "t": "timestamp"})
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    return df.set_index("timestamp")


def get_quotes(symbol: str, start_iso: str, end_iso: str) -> pd.DataFrame:
    data = _get(f"/stocks/{symbol}/quotes", {"start": start_iso, "end": end_iso, "limit": 10000})
    quotes = (data or {}).get("quotes", [])
    if not quotes:
        return pd.DataFrame()

    df = pd.DataFrame(quotes)
    df = df.rename(columns={"bp": "bid_price", "bs": "bid_size", "ap": "ask_price", "as": "ask_size", "t": "timestamp"})
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    return df


def get_trades(symbol: str, start_iso: str, end_iso: str) -> pd.DataFrame:
    data = _get(f"/stocks/{symbol}/trades", {"start": start_iso, "end": end_iso, "limit": 10000})
    trades = (data or {}).get("trades", [])
    if not trades:
        return pd.DataFrame()

    df = pd.DataFrame(trades)
    df = df.rename(columns={"p": "price", "s": "size", "x": "exchange", "t": "timestamp"})
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    # No trf_id: IEX-only free feed carries no TRF/off-exchange tagging, so
    # dark_pool.py's real (non-proxy) branch — which requires that column —
    # won't activate from this source. VWAP/OFI don't need it.
    return df
