"""Historical OHLCV for backtesting. Alpha Vantage's free tier (25 req/day) can't
sustain pulling years of daily history across many assets, so the tournament uses
Yahoo Finance via yfinance instead — free, no key, no meaningful rate limit. This
mirrors the same swap the sibling Next.js dashboard already made for live quotes."""

from __future__ import annotations

import pandas as pd
import yfinance as yf


def load_daily_history(symbol: str, period: str = "5y") -> pd.DataFrame:
    df = yf.download(symbol, period=period, interval="1d", progress=False, auto_adjust=True)
    if df.empty:
        return df

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    df = df.rename(columns={c: c.lower() for c in df.columns})
    return df[["open", "high", "low", "close", "volume"]].dropna()
