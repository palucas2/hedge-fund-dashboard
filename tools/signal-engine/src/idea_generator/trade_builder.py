"""Turns a scored TradeIdea into an actual trade spec — the piece that was
missing between "conviction 69, SHORT" and something you could log or act on.

Sizing is vol-targeted (scale down on choppy assets, up to a hard cap on calm
ones) because the tournament's portfolio backtest (tools/signal-engine/
tournament/portfolio_bots.py) showed this roughly halves max drawdown and
lifts Sharpe versus flat sizing — it's the one tournament finding solid enough
to build on directly. Stops/targets are vol-based (a multiple of recent daily
realized vol) rather than fixed percentages, since a fixed 5% stop means
something very different on TLT than on BTC-USD.

None of the thresholds here (TARGET_ANNUAL_VOL, MAX_POSITION_PCT, the stop/
target multipliers, the conviction cutoffs) have themselves been backtested —
they're reasonable starting defaults, not tuned outputs. Validate before
sizing real capital off this.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

import config
from src.models.schemas import TradeIdea, TradeSpec


def compute_realized_vol(price_df: pd.DataFrame, lookback: int = 20) -> tuple[float | None, float | None]:
    """Returns (daily_vol, annualized_vol) or (None, None) if there's not enough history."""
    if price_df.empty or len(price_df) < lookback + 1:
        return None, None
    returns = price_df["close"].pct_change().dropna().tail(lookback)
    if returns.empty:
        return None, None
    daily_vol = float(returns.std())
    return daily_vol, daily_vol * np.sqrt(252)


def build_trade_spec(idea: TradeIdea, price_df: pd.DataFrame) -> TradeSpec:
    daily_vol, annual_vol = compute_realized_vol(price_df)
    entry_price = float(price_df["close"].iloc[-1]) if not price_df.empty else None

    if idea.direction == "neutral" or idea.conviction < config.CONVICTION_WATCH_THRESHOLD:
        action = "skip"
        reason = f"conviction {idea.conviction} below watch threshold ({config.CONVICTION_WATCH_THRESHOLD}), or no directional call"
    elif idea.conviction < config.CONVICTION_TAKE_THRESHOLD:
        action = "watch"
        reason = f"conviction {idea.conviction} clears watch ({config.CONVICTION_WATCH_THRESHOLD}) but not take ({config.CONVICTION_TAKE_THRESHOLD})"
    elif entry_price is None or annual_vol is None or annual_vol <= 0:
        action = "watch"
        reason = "conviction clears take threshold but insufficient price history to size/risk-manage safely"
    else:
        action = "take"
        reason = f"conviction {idea.conviction} >= take threshold ({config.CONVICTION_TAKE_THRESHOLD})"

    size_pct = 0.0
    stop_loss = None
    take_profit = None

    if action == "take":
        vol_scale = min(config.TARGET_ANNUAL_VOL / annual_vol, 1.0)
        size_pct = round(config.MAX_POSITION_PCT * vol_scale, 4)

        stop_distance = config.STOP_LOSS_VOL_MULTIPLIER * daily_vol
        target_distance = config.TAKE_PROFIT_VOL_MULTIPLIER * daily_vol
        if idea.direction == "long":
            stop_loss = round(entry_price * (1 - stop_distance), 4)
            take_profit = round(entry_price * (1 + target_distance), 4)
        else:  # short
            stop_loss = round(entry_price * (1 + stop_distance), 4)
            take_profit = round(entry_price * (1 - target_distance), 4)

    return TradeSpec(
        idea=idea,
        action=action,
        entry_price=entry_price,
        size_pct=size_pct,
        stop_loss=stop_loss,
        take_profit=take_profit,
        realized_vol_annualized=annual_vol,
        rationale=reason,
    )
