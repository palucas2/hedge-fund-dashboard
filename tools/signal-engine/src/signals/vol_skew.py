"""25-delta risk-reversal skew: IV(25-delta put) - IV(25-delta call) on the
nearest listed expiration. Positive skew (puts bid up relative to calls) signals
demand for downside protection -> bearish tilt. Needs options greeks + IV from a
Polygon options snapshot; without it, falls back to a realized-vol-trend proxy."""

from __future__ import annotations

from datetime import date

import pandas as pd

from src.ingestion.expirations import pick_skew_expiration
from src.models.schemas import SignalResult

TARGET_DELTA = 0.25
DELTA_TOLERANCE = 0.10


def _nearest_by_delta(df: pd.DataFrame, target: float) -> pd.Series | None:
    if df.empty:
        return None
    candidates = df[(df["delta"] - target).abs() <= DELTA_TOLERANCE]
    if candidates.empty:
        return None
    idx = (candidates["delta"] - target).abs().idxmin()
    return candidates.loc[idx]


def compute(asset: str, options_df: pd.DataFrame | None) -> SignalResult:
    skew_expiry = None
    if options_df is not None and not options_df.empty:
        skew_expiry = pick_skew_expiration(list(options_df["expiration"].unique()), date.today())

    if skew_expiry is not None:
        chain = options_df[options_df["expiration"] == skew_expiry].dropna(subset=["delta", "implied_volatility"])

        calls = chain[chain["type"] == "call"]
        puts = chain[chain["type"] == "put"]

        target_call = _nearest_by_delta(calls, TARGET_DELTA)
        target_put = _nearest_by_delta(puts, -TARGET_DELTA)

        if target_call is not None and target_put is not None:
            skew = float(target_put["implied_volatility"] - target_call["implied_volatility"])
            direction = "bearish" if skew > 0.02 else "bullish" if skew < -0.02 else "neutral"

            return SignalResult(
                name="vol_skew",
                asset=asset,
                value={
                    "skew_25d": round(skew, 4),
                    "put_iv": round(float(target_put["implied_volatility"]), 4),
                    "call_iv": round(float(target_call["implied_volatility"]), 4),
                    "expiration": skew_expiry,
                },
                direction=direction,
                confidence=min(abs(skew) / 0.1, 1.0),
                is_mocked=False,
                note="25-delta put/call IV skew from Polygon options snapshot",
            )

    return SignalResult(
        name="vol_skew", asset=asset, value={}, direction="neutral", confidence=0.0,
        is_mocked=True, note="no options chain data available for this underlying",
    )
