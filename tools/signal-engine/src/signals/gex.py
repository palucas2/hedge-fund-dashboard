"""Aggregate dealer Gamma Exposure (GEX), SpotGamma/SqueezeMetrics-style convention:

  GEX = Sigma(call_OI * call_gamma) * spot^2 * 0.01 * 100
      - Sigma(put_OI  * put_gamma)  * spot^2 * 0.01 * 100

Positive GEX -> dealers net long gamma -> they hedge by buying dips / selling
rallies -> volatility-suppressing, price tends to pin. Negative GEX -> dealers
net short gamma -> hedging amplifies moves in whatever direction price is
already going. Needs a Polygon options snapshot (OI + greeks); without it,
falls back to a realized-vol-percentile proxy for the regime call only."""

from __future__ import annotations

import pandas as pd

from src.models.schemas import SignalResult


def compute(asset: str, options_df: pd.DataFrame | None, spot_price: float | None, price_df: pd.DataFrame | None = None) -> SignalResult:
    if options_df is not None and not options_df.empty and spot_price:
        calls = options_df[options_df["type"] == "call"].dropna(subset=["open_interest", "gamma"])
        puts = options_df[options_df["type"] == "put"].dropna(subset=["open_interest", "gamma"])

        call_gex = (calls["open_interest"] * calls["gamma"]).sum() * spot_price**2 * 0.01 * 100
        put_gex = (puts["open_interest"] * puts["gamma"]).sum() * spot_price**2 * 0.01 * 100
        net_gex = float(call_gex - put_gex)

        if net_gex > 0:
            regime = "pinning"
            direction = "neutral"
            confidence = min(abs(net_gex) / 5e8, 0.9)
        else:
            regime = "amplifying"
            confidence = min(abs(net_gex) / 5e8, 0.9)
            if price_df is not None and not price_df.empty:
                momentum = price_df["close"].iloc[-1] - price_df["close"].iloc[-5]
                direction = "bullish" if momentum > 0 else "bearish"
            else:
                direction = "neutral"

        return SignalResult(
            name="gex",
            asset=asset,
            value={"net_gex": round(net_gex, 0), "regime": regime},
            direction=direction,
            confidence=round(float(confidence), 3),
            is_mocked=False,
            note="aggregate dealer gamma from Polygon options snapshot (OI x gamma)",
        )

    if price_df is not None and len(price_df) >= 30:
        returns = price_df["close"].pct_change().dropna()
        realized_vol = returns.tail(20).std()
        vol_history = returns.rolling(20).std().dropna()
        percentile = (vol_history < realized_vol).mean() if len(vol_history) else 0.5

        # low realized-vol percentile is loosely associated with positive-gamma
        # pinning regimes in practice; this is a heuristic, not a measurement
        regime = "pinning" if percentile < 0.5 else "amplifying"
        direction = "neutral" if regime == "pinning" else ("bullish" if returns.tail(5).sum() > 0 else "bearish")

        return SignalResult(
            name="gex",
            asset=asset,
            value={"realized_vol_percentile": round(float(percentile), 3), "regime": regime},
            direction=direction,
            confidence=0.25,
            is_mocked=True,
            note="proxy from realized-vol percentile — no options chain data available",
        )

    return SignalResult(
        name="gex", asset=asset, value={}, direction="neutral", confidence=0.0,
        is_mocked=True, note="no options or price data available",
    )
