"""Structural break detection on the log-price series. True Bai-Perron uses a
sequential sup-F test to pick both the number and location of breaks; here we
use PELT (Killick et al.) with a BIC-style penalty as a practical equivalent —
same "let the data pick the number of breakpoints" spirit, tractable in
Python without a dedicated Bai-Perron package."""

import numpy as np
import pandas as pd
import ruptures as rpt

from src.models.schemas import SignalResult


def compute(asset: str, price_df: pd.DataFrame, min_segment_size: int = 10) -> SignalResult:
    if price_df.empty or len(price_df) < min_segment_size * 2:
        return SignalResult(
            name="bai_perron",
            asset=asset,
            value={},
            direction="neutral",
            confidence=0.0,
            is_mocked=True,
            note=f"insufficient price history (<{min_segment_size * 2} obs) for breakpoint detection",
        )

    log_prices = np.log(price_df["close"].values.astype(float))
    n = len(log_prices)
    penalty = np.log(n) * np.var(log_prices)

    algo = rpt.Pelt(model="l2", min_size=min_segment_size).fit(log_prices)
    breakpoints = algo.predict(pen=penalty)
    interior_breaks = [b for b in breakpoints if b < n]

    if not interior_breaks:
        return SignalResult(
            name="bai_perron",
            asset=asset,
            value={"breakpoints": []},
            direction="neutral",
            confidence=0.3,
            is_mocked=False,
            note="no structural break detected — regime has been stable",
        )

    last_break = interior_breaks[-1]
    post_break_segment = log_prices[last_break:]
    x = np.arange(len(post_break_segment))
    slope, _ = np.polyfit(x, post_break_segment, 1)

    direction = "bullish" if slope > 0 else "bearish" if slope < 0 else "neutral"
    obs_since_break = n - last_break
    confidence = min(0.3 + 0.5 * min(obs_since_break / min_segment_size, 1.0), 0.9)

    return SignalResult(
        name="bai_perron",
        asset=asset,
        value={
            "breakpoints": interior_breaks,
            "last_break_index": int(last_break),
            "obs_since_last_break": int(obs_since_break),
            "post_break_slope": round(float(slope), 6),
        },
        direction=direction,
        confidence=round(float(confidence), 3),
        is_mocked=False,
        note="PELT (l2 cost, BIC penalty) breakpoint detection on log-price",
    )
