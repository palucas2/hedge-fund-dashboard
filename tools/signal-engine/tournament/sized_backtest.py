"""Backtests the ACTUAL production sizing/stop formula (src/idea_generator/
sizing.py) on top of full_stack's directional signal — imports the same
vol_targeted_size_pct/stop_and_target_distance functions the live pipeline's
trade_builder.py uses, not a reimplementation that could drift out of sync.
This is what closes the loop the README asks for: validate trade_builder's
exact sizing/stop rule historically, not just the raw directional bots.

Manual equity-curve simulation rather than vectorbt's from_signals(sl_stop=...,
tp_stop=...) — OHLC-based stop/target triggering (did the day's low/high cross
the stop?) is more transparent to reason about and verify directly than that
corner of the vectorbt API on a first pass.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.idea_generator.sizing import stop_and_target_distance, vol_targeted_size_pct
from tournament.bots import full_stack_bot
from tournament.engine import DEFAULT_FEES


def _causal_vol_series(price_df: pd.DataFrame, lookback: int = 20) -> tuple[pd.Series, pd.Series]:
    """Daily/annualized realized vol, shifted so the value available at day i
    only reflects returns through day i-1 — same causality guarantee as
    trade_builder.compute_realized_vol, just precomputed for the whole series."""
    returns = price_df["close"].pct_change()
    daily_vol = returns.rolling(lookback).std().shift(1)
    return daily_vol, daily_vol * np.sqrt(252)


def backtest_sized_full_stack(price_df: pd.DataFrame, fees: float = DEFAULT_FEES, refit_every: int = 21, min_obs: int = 80) -> dict:
    signal = full_stack_bot(price_df, refit_every=refit_every, min_obs=min_obs).shift(1).fillna(0.0)
    daily_vol_s, annual_vol_s = _causal_vol_series(price_df)

    n = len(price_df)
    close = price_df["close"].values
    high = price_df["high"].values
    low = price_df["low"].values

    daily_returns = np.zeros(n)
    position = 0.0
    size_pct = 0.0
    stop_loss = None
    take_profit = None
    trade_count = 0

    for i in range(1, n):
        prev_close = close[i - 1]
        ret = 0.0

        if position != 0:
            exit_price = None
            if position == 1:
                if low[i] <= stop_loss:
                    exit_price = stop_loss
                elif high[i] >= take_profit:
                    exit_price = take_profit
            else:
                if high[i] >= stop_loss:
                    exit_price = stop_loss
                elif low[i] <= take_profit:
                    exit_price = take_profit

            if exit_price is not None:
                ret = position * size_pct * (exit_price - prev_close) / prev_close - fees * size_pct
                position, size_pct, stop_loss, take_profit = 0.0, 0.0, None, None
            elif signal.iloc[i] != position:
                ret = position * size_pct * (close[i] - prev_close) / prev_close - fees * size_pct
                position, size_pct, stop_loss, take_profit = 0.0, 0.0, None, None
            else:
                ret = position * size_pct * (close[i] - prev_close) / prev_close

        if position == 0 and signal.iloc[i] != 0:
            av, dv = annual_vol_s.iloc[i], daily_vol_s.iloc[i]
            if pd.notna(av) and pd.notna(dv) and av > 0:
                new_size = vol_targeted_size_pct(av)
                if new_size > 0:
                    position = signal.iloc[i]
                    size_pct = new_size
                    entry_price = close[i]
                    stop_dist, target_dist = stop_and_target_distance(dv)
                    if position == 1:
                        stop_loss = entry_price * (1 - stop_dist)
                        take_profit = entry_price * (1 + target_dist)
                    else:
                        stop_loss = entry_price * (1 + stop_dist)
                        take_profit = entry_price * (1 - target_dist)
                    ret -= fees * size_pct
                    trade_count += 1

        daily_returns[i] = ret

    equity = np.cumprod(1 + daily_returns)
    total_return_pct = (equity[-1] - 1) * 100
    sharpe = float(np.mean(daily_returns) / np.std(daily_returns) * np.sqrt(252)) if np.std(daily_returns) > 0 else None
    running_max = np.maximum.accumulate(equity)
    max_drawdown_pct = float(np.max((running_max - equity) / running_max) * 100)

    return {
        "total_return_pct": float(total_return_pct),
        "sharpe_ratio": sharpe,
        "max_drawdown_pct": max_drawdown_pct,
        "trade_count": trade_count,
    }
