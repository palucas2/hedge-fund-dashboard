"""Portfolio-level sizing and combination on top of the single-asset bots in
bots.py. A single-asset backtest is a noisy way to judge whether a bot is any
good — vol-targeting (same directional call, smaller size when the asset is
choppy) and combining several assets into one portfolio return series cuts
down the asset-specific luck that dominates a lone equity curve.
"""

from __future__ import annotations

from typing import Callable

import numpy as np
import pandas as pd

TRADING_DAYS_PER_YEAR = 252


def vol_target_position(
    price_df: pd.DataFrame,
    base_position_fn: Callable[[pd.DataFrame], pd.Series],
    target_annual_vol: float = 0.15,
    lookback: int = 20,
    max_leverage: float = 2.0,
) -> pd.Series:
    """Scales a bot's raw -1/0/1 call by target_vol / realized_vol (both
    causal — the realized-vol window ending at t only uses data up to t), so
    the same directional signal takes a smaller position when the asset has
    been choppy and a bigger one when it's been calm. Scale factor and the
    resulting position are both clipped to +/-max_leverage.
    """
    raw = base_position_fn(price_df)

    returns = price_df["close"].pct_change()
    realized_vol = returns.rolling(lookback).std() * np.sqrt(TRADING_DAYS_PER_YEAR)
    realized_vol = realized_vol.clip(lower=1e-4)  # guard against div-by-near-zero on flat stretches

    scale = (target_annual_vol / realized_vol).clip(upper=max_leverage)
    scaled = (raw * scale).clip(-max_leverage, max_leverage)
    return scaled.fillna(0.0)


def combine_portfolio(
    asset_position_map: dict[str, pd.Series],
    asset_prices: dict[str, pd.DataFrame],
    weight_scheme: str = "equal",
) -> pd.Series:
    """Combines several single-asset position series (already sized, e.g. via
    vol_target_position) into one portfolio equity curve, assuming equal
    capital allocation rebalanced daily. Positions are shifted one bar forward
    before being applied — a position derived from day t's close can't be
    traded until day t+1, matching the convention used in engine.py.

    Different assets keep different trading calendars (crypto trades weekends,
    equities don't); we union all calendars, forward-fill each asset's
    shifted position through gaps, and treat a no-trade day as a zero return
    for that asset's leg rather than dropping it.
    """
    if weight_scheme != "equal":
        raise ValueError(f"unsupported weight_scheme: {weight_scheme!r}")

    symbols = list(asset_position_map.keys())
    if not symbols:
        raise ValueError("asset_position_map is empty")

    all_dates = sorted(set().union(*(asset_prices[s].index for s in symbols)))
    index = pd.DatetimeIndex(all_dates)

    weight = 1.0 / len(symbols)
    contributions = []

    for symbol in symbols:
        price_df = asset_prices[symbol]
        position = asset_position_map[symbol].shift(1)

        returns = price_df["close"].pct_change().reindex(index).fillna(0.0)
        position = position.reindex(index).ffill().fillna(0.0)

        contributions.append(weight * position * returns)

    portfolio_daily_return = pd.concat(contributions, axis=1).sum(axis=1)
    equity_curve = (1.0 + portfolio_daily_return).cumprod()
    equity_curve.name = "equity"
    return equity_curve
