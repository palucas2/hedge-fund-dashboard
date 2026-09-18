"""VIX vs VIX3M term structure. Backwardation (front-month VIX above VIX3M)
signals acute near-term stress and tends to accompany risk-off tape; contango
(the normal state) signals a calm regime. Tries Polygon's indices aggregates
(needs an Indices add-on); falls back to a realized-vol term-structure proxy
built from a benchmark equity index's own short vs. longer realized vol."""

from __future__ import annotations

import pandas as pd

from src.ingestion import market_data_client
from src.models.schemas import SignalResult


def _latest_close(df: pd.DataFrame) -> float | None:
    if df.empty or "close" not in df.columns:
        return None
    return float(df["close"].iloc[-1])


def compute(from_date: str, to_date: str, benchmark_price_df: pd.DataFrame | None = None) -> SignalResult:
    vix_df = market_data_client.get_intraday_aggregates("I:VIX", from_date, to_date, timespan="day")
    vix3m_df = market_data_client.get_intraday_aggregates("I:VIX3M", from_date, to_date, timespan="day")

    vix = _latest_close(vix_df)
    vix3m = _latest_close(vix3m_df)

    if vix is not None and vix3m is not None:
        spread = vix - vix3m
        state = "backwardation" if spread > 0 else "contango"
        direction = "bearish" if state == "backwardation" else "neutral"

        return SignalResult(
            name="vix_term_structure",
            asset="VIX",
            value={"vix": vix, "vix3m": vix3m, "spread": round(spread, 3), "state": state},
            direction=direction,
            confidence=min(abs(spread) / 5.0, 1.0),
            is_mocked=False,
            note="VIX vs VIX3M from Polygon index aggregates",
        )

    if benchmark_price_df is not None and len(benchmark_price_df) >= 65:
        returns = benchmark_price_df["close"].pct_change().dropna()
        short_vol = returns.tail(10).std() * (252**0.5) * 100
        long_vol = returns.tail(60).std() * (252**0.5) * 100
        spread = short_vol - long_vol
        state = "backwardation" if spread > 0 else "contango"
        direction = "bearish" if state == "backwardation" else "neutral"

        return SignalResult(
            name="vix_term_structure",
            asset="VIX",
            value={"short_realized_vol": round(float(short_vol), 2), "long_realized_vol": round(float(long_vol), 2), "state": state},
            direction=direction,
            confidence=min(abs(spread) / 10.0, 0.6),
            is_mocked=True,
            note="proxy from benchmark 10d vs 60d realized vol — no Polygon indices access",
        )

    return SignalResult(
        name="vix_term_structure", asset="VIX", value={}, direction="neutral", confidence=0.0,
        is_mocked=True, note="no VIX or benchmark data available",
    )
