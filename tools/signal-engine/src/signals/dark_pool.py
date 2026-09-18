"""Dark pool / off-exchange print detection. Real implementation flags trades
reported through a Trade Reporting Facility (Polygon tags these with a non-null
trf_id) and measures what share of the day's volume printed off-exchange vs the
~35-40% baseline dark/OTC share equities typically carry. Falls back to a
volume-vs-price-impact heuristic when tick trade data isn't available."""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.models.schemas import SignalResult

BASELINE_DARK_POOL_SHARE = 0.38


def compute(asset: str, trades_df: pd.DataFrame | None = None, daily_df: pd.DataFrame | None = None) -> SignalResult:
    if trades_df is not None and not trades_df.empty and "trf_id" in trades_df.columns and "size" in trades_df.columns:
        trf_mask = trades_df["trf_id"].notna()
        total_volume = trades_df["size"].sum()
        dark_volume = trades_df.loc[trf_mask, "size"].sum()

        if total_volume > 0:
            dark_share = float(dark_volume / total_volume)
            lit_price = trades_df.loc[~trf_mask, "price"].mean() if (~trf_mask).any() else np.nan
            dark_price = trades_df.loc[trf_mask, "price"].mean() if trf_mask.any() else np.nan

            elevated = dark_share > BASELINE_DARK_POOL_SHARE + 0.1
            if elevated and pd.notna(dark_price) and pd.notna(lit_price):
                direction = "bullish" if dark_price >= lit_price else "bearish"
                confidence = min((dark_share - BASELINE_DARK_POOL_SHARE) / 0.3, 1.0)
            else:
                direction = "neutral"
                confidence = 0.2

            return SignalResult(
                name="dark_pool",
                asset=asset,
                value={
                    "dark_pool_share": round(dark_share, 4),
                    "baseline_share": BASELINE_DARK_POOL_SHARE,
                    "elevated": elevated,
                },
                direction=direction,
                confidence=round(float(confidence), 3),
                is_mocked=False,
                note=f"TRF-tagged trades over {len(trades_df)} prints",
            )

    if daily_df is not None and len(daily_df) >= 21:
        latest = daily_df.iloc[-1]
        avg_volume = daily_df["volume"].iloc[-21:-1].mean()
        volume_ratio = latest["volume"] / max(avg_volume, 1)
        price_move_pct = abs((latest["close"] - latest["open"]) / latest["open"]) * 100

        # high volume with a muted price move suggests size being absorbed off-tape
        stealth_accumulation = volume_ratio > 1.5 and price_move_pct < 0.5
        direction = "neutral"
        confidence = 0.15
        if stealth_accumulation:
            direction = "bullish" if latest["close"] >= latest["open"] else "bearish"
            confidence = min((volume_ratio - 1.5) / 2.0, 0.6)

        return SignalResult(
            name="dark_pool",
            asset=asset,
            value={"volume_ratio_vs_20d": round(float(volume_ratio), 2), "price_move_pct": round(float(price_move_pct), 3)},
            direction=direction,
            confidence=round(confidence, 3),
            is_mocked=True,
            note="proxy: high volume + muted price move as stand-in for hidden print activity — no TRF tick data available",
        )

    return SignalResult(
        name="dark_pool", asset=asset, value={}, direction="neutral", confidence=0.0,
        is_mocked=True, note="no trade or price data available",
    )
