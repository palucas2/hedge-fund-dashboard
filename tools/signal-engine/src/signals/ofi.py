"""Order Flow Imbalance (Cont-Kukanov-Stoikov formulation) from the NBBO quote
tape: each quote update contributes +/-size depending on whether the bid/ask
price improved, worsened, or held with a size change. Needs a Polygon quotes
tier; falls back to a signed-volume proxy from the daily bar (close vs open)
when tick data isn't available."""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.models.schemas import SignalResult


def _bid_contribution(row, prev_row) -> float:
    if row["bid_price"] > prev_row["bid_price"]:
        return row["bid_size"]
    if row["bid_price"] < prev_row["bid_price"]:
        return -prev_row["bid_size"]
    return row["bid_size"] - prev_row["bid_size"]


def _ask_contribution(row, prev_row) -> float:
    if row["ask_price"] > prev_row["ask_price"]:
        return -prev_row["ask_size"]
    if row["ask_price"] < prev_row["ask_price"]:
        return prev_row["ask_size"]
    return row["ask_size"] - prev_row["ask_size"]


def compute(asset: str, quotes_df: pd.DataFrame | None = None, daily_df: pd.DataFrame | None = None) -> SignalResult:
    required_cols = {"bid_price", "bid_size", "ask_price", "ask_size"}
    if quotes_df is not None and not quotes_df.empty and required_cols.issubset(quotes_df.columns):
        df = quotes_df.dropna(subset=list(required_cols))
        if len(df) >= 2:
            contributions = [
                _bid_contribution(df.iloc[i], df.iloc[i - 1]) - _ask_contribution(df.iloc[i], df.iloc[i - 1])
                for i in range(1, len(df))
            ]
            ofi = float(np.sum(contributions))
            normalized = ofi / max(df["bid_size"].mean() + df["ask_size"].mean(), 1)

            direction = "bullish" if normalized > 0.05 else "bearish" if normalized < -0.05 else "neutral"
            return SignalResult(
                name="ofi",
                asset=asset,
                value={"ofi_raw": round(ofi, 2), "ofi_normalized": round(float(normalized), 4)},
                direction=direction,
                confidence=min(abs(normalized), 1.0),
                is_mocked=False,
                note=f"CKS order flow imbalance over {len(df)} NBBO quote updates",
            )

    if daily_df is not None and not daily_df.empty:
        latest = daily_df.iloc[-1]
        signed_volume = np.sign(latest["close"] - latest["open"]) * latest["volume"]
        avg_volume = daily_df["volume"].tail(20).mean()
        normalized = float(signed_volume / max(avg_volume, 1))

        direction = "bullish" if normalized > 0.1 else "bearish" if normalized < -0.1 else "neutral"
        return SignalResult(
            name="ofi",
            asset=asset,
            value={"signed_volume_proxy": round(float(signed_volume), 0), "normalized": round(normalized, 4)},
            direction=direction,
            confidence=min(abs(normalized), 1.0),
            is_mocked=True,
            note="proxy from daily close-vs-open signed volume — no tick quote data available",
        )

    return SignalResult(
        name="ofi", asset=asset, value={}, direction="neutral", confidence=0.0,
        is_mocked=True, note="no quote or price data available",
    )
