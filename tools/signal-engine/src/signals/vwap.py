"""VWAP deviation signal. Uses real intraday bars (Polygon) when available —
true session VWAP. Falls back to a daily-bar approximation (typical price
volume-weighted over the trailing window) when only EOD data is on hand,
which is a coarser proxy and flagged as such."""

from __future__ import annotations

import pandas as pd

from src.models.schemas import SignalResult


def _direction_from_deviation(deviation_pct: float) -> str:
    if deviation_pct > 0.15:
        return "bullish"
    if deviation_pct < -0.15:
        return "bearish"
    return "neutral"


def compute(asset: str, intraday_df: pd.DataFrame | None = None, daily_df: pd.DataFrame | None = None) -> SignalResult:
    if (
        intraday_df is not None
        and not intraday_df.empty
        and "vwap" in intraday_df.columns
        and intraday_df["volume"].sum() > 0
    ):
        cum_vwap = (intraday_df["vwap"] * intraday_df["volume"]).sum() / intraday_df["volume"].sum()
        latest_price = intraday_df["close"].iloc[-1]
        deviation_pct = (latest_price - cum_vwap) / cum_vwap * 100

        return SignalResult(
            name="vwap",
            asset=asset,
            value={"vwap": round(float(cum_vwap), 4), "price_vs_vwap_pct": round(float(deviation_pct), 3)},
            direction=_direction_from_deviation(deviation_pct),
            confidence=min(abs(deviation_pct) / 1.0, 1.0),
            is_mocked=False,
            note="intraday session VWAP from Polygon minute bars",
        )

    if daily_df is not None and not daily_df.empty and len(daily_df) >= 5 and daily_df["volume"].tail(20).sum() > 0:
        window = daily_df.tail(20).copy()
        typical_price = (window["high"] + window["low"] + window["close"]) / 3
        vwap_proxy = (typical_price * window["volume"]).sum() / window["volume"].sum()
        latest_price = daily_df["close"].iloc[-1]
        deviation_pct = (latest_price - vwap_proxy) / vwap_proxy * 100

        return SignalResult(
            name="vwap",
            asset=asset,
            value={"vwap_proxy": round(float(vwap_proxy), 4), "price_vs_vwap_pct": round(float(deviation_pct), 3)},
            direction=_direction_from_deviation(deviation_pct),
            confidence=min(abs(deviation_pct) / 2.0, 1.0),
            is_mocked=True,
            note="20-day typical-price VWAP proxy — no intraday data available",
        )

    return SignalResult(
        name="vwap", asset=asset, value={}, direction="neutral", confidence=0.0,
        is_mocked=True, note="no price data available",
    )
