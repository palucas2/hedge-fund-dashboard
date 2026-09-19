"""Turns the existing signal bank into daily position series (-1 short, 0 flat,
1 long) for backtesting. HMM/Bai-Perron are refit periodically on an expanding
window (walk-forward, no lookahead) rather than every single day — refitting an
HMM daily over years of history per asset per bot would be needlessly slow for
what's still the same regime call almost every day. Kalman is naturally causal
(each point only uses data up to it), so it's computed once over the full series.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.signals import bai_perron, hmm_regime
from src.signals.kalman_filter import _run_kalman

DIRECTION_TO_POSITION = {"bullish": 1.0, "bearish": -1.0, "neutral": 0.0}


def buy_and_hold(price_df: pd.DataFrame) -> pd.Series:
    return pd.Series(1.0, index=price_df.index)


def _walk_forward_direction(
    price_df: pd.DataFrame, compute_fn, refit_every: int, min_obs: int
) -> pd.Series:
    positions = pd.Series(0.0, index=price_df.index)
    last_direction = "neutral"

    for i in range(len(price_df)):
        if i < min_obs:
            continue
        if i == min_obs or (i - min_obs) % refit_every == 0:
            window = price_df.iloc[: i + 1]
            result = compute_fn("BACKTEST", window)
            last_direction = result.direction
        positions.iloc[i] = DIRECTION_TO_POSITION[last_direction]

    return positions


def hmm_regime_bot(price_df: pd.DataFrame, refit_every: int = 21, min_obs: int = 80) -> pd.Series:
    return _walk_forward_direction(price_df, hmm_regime.compute, refit_every, min_obs)


def bai_perron_bot(price_df: pd.DataFrame, refit_every: int = 21, min_obs: int = 40) -> pd.Series:
    return _walk_forward_direction(price_df, bai_perron.compute, refit_every, min_obs)


def kalman_trend_bot(price_df: pd.DataFrame, min_obs: int = 20) -> pd.Series:
    if len(price_df) < min_obs:
        return pd.Series(0.0, index=price_df.index)

    prices = price_df["close"].values.astype(float)
    _, trends = _run_kalman(prices)

    positions = pd.Series(0.0, index=price_df.index)
    signs = np.sign(trends)
    positions.iloc[min_obs:] = signs[min_obs:]
    return positions


def full_stack_bot(price_df: pd.DataFrame, refit_every: int = 21, min_obs: int = 80) -> pd.Series:
    """Majority vote across HMM regime, Bai-Perron post-break slope, and Kalman
    trend sign — refit on the same walk-forward cadence as the individual bots."""
    positions = pd.Series(0.0, index=price_df.index)
    prices = price_df["close"].values.astype(float)
    _, trends = _run_kalman(prices)
    kalman_signs = np.sign(trends)

    last_vote = 0.0
    for i in range(len(price_df)):
        if i < min_obs:
            continue
        if i == min_obs or (i - min_obs) % refit_every == 0:
            window = price_df.iloc[: i + 1]
            hmm_dir = DIRECTION_TO_POSITION[hmm_regime.compute("BACKTEST", window).direction]
            bp_dir = DIRECTION_TO_POSITION[bai_perron.compute("BACKTEST", window).direction]
            kalman_dir = float(kalman_signs[i])
            vote = hmm_dir + bp_dir + kalman_dir
            last_vote = 1.0 if vote > 0.5 else -1.0 if vote < -0.5 else 0.0
        positions.iloc[i] = last_vote

    return positions


BOTS = {
    "buy_and_hold": buy_and_hold,
    "hmm_regime": hmm_regime_bot,
    "bai_perron": bai_perron_bot,
    "kalman_trend": kalman_trend_bot,
    "full_stack": full_stack_bot,
}
