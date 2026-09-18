"""Volatility Risk Premium = implied vol - realized vol (both annualized).
Realized vol is always computed for real from the price series. Implied vol
comes from the ATM contract on a Polygon options snapshot when available;
otherwise a 60-day realized-vol window stands in as a rough proxy for the
market's vol expectation (systematically understates true IV, which normally
carries a premium — flagged as mocked)."""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.models.schemas import SignalResult

ATM_MONEYNESS_TOLERANCE = 0.03


def _atm_iv(options_df: pd.DataFrame, spot_price: float) -> float | None:
    if options_df.empty:
        return None
    nearest_expiry = options_df["expiration"].min()
    chain = options_df[options_df["expiration"] == nearest_expiry].dropna(subset=["strike", "implied_volatility"])
    if chain.empty:
        return None
    chain = chain.copy()
    chain["moneyness_dist"] = (chain["strike"] - spot_price).abs() / spot_price
    atm = chain[chain["moneyness_dist"] <= ATM_MONEYNESS_TOLERANCE]
    if atm.empty:
        atm = chain.nsmallest(3, "moneyness_dist")
    return float(atm["implied_volatility"].mean())


def compute(asset: str, price_df: pd.DataFrame, options_df: pd.DataFrame | None = None, spot_price: float | None = None) -> SignalResult:
    if price_df.empty or len(price_df) < 25:
        return SignalResult(
            name="vrp", asset=asset, value={}, direction="neutral", confidence=0.0,
            is_mocked=True, note="insufficient price history for realized vol",
        )

    returns = price_df["close"].pct_change().dropna()
    realized_vol = float(returns.tail(20).std() * np.sqrt(252))

    implied_vol = None
    is_mocked = True
    if options_df is not None and spot_price:
        implied_vol = _atm_iv(options_df, spot_price)
        if implied_vol is not None:
            is_mocked = False

    if implied_vol is None:
        implied_vol = float(returns.tail(60).std() * np.sqrt(252))

    vrp = implied_vol - realized_vol
    # negative VRP (IV below RV) is unusual and often precedes vol spikes -> risk-off
    # positive VRP within normal range is the typical, carry-friendly state
    if vrp < -0.02:
        direction = "bearish"
    elif vrp > 0.08:
        direction = "neutral"  # rich premium, favors vol-selling, not directional
    else:
        direction = "neutral"

    return SignalResult(
        name="vrp",
        asset=asset,
        value={
            "implied_vol": round(implied_vol, 4),
            "realized_vol": round(realized_vol, 4),
            "vrp": round(vrp, 4),
        },
        direction=direction,
        confidence=min(abs(vrp) / 0.15, 1.0),
        is_mocked=is_mocked,
        note="ATM IV from options snapshot" if not is_mocked else "60d realized vol used as IV proxy — no options data",
    )
