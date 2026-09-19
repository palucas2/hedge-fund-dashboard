"""Volatility-regime filter: wraps any bot's position series and forces it flat
whenever realized volatility is unusually high relative to its own recent
history. The idea is that trend/regime signals tend to whipsaw during violent,
choppy stretches — better to sit out than keep trading a signal that isn't
working in that regime. Walk-forward throughout: the "unusually high" threshold
at day t is computed only from volatility observed up to day t, never future
data.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tournament.bots import full_stack_bot


def realized_vol(price_df: pd.DataFrame, lookback: int = 20) -> pd.Series:
    returns = price_df["close"].pct_change()
    return returns.rolling(lookback).std() * np.sqrt(252)


def vol_filtered_bot(
    price_df: pd.DataFrame,
    base_position_fn,
    vol_percentile_threshold: float = 75,
    vol_lookback: int = 20,
    calibration_window: int = 252,
) -> pd.Series:
    base_positions = base_position_fn(price_df)
    vol = realized_vol(price_df, lookback=vol_lookback)

    # Rolling percentile threshold: "high vol" is relative to this asset's own
    # trailing calibration_window, not a fixed absolute cutoff shared across
    # assets with very different baseline volatility (e.g. TLT vs BTC-USD).
    threshold = vol.rolling(calibration_window).quantile(vol_percentile_threshold / 100.0)

    # Where vol or threshold isn't calibrated yet (early history), the
    # comparison is False by pandas NaN semantics, so the base bot's signal
    # passes through unfiltered until there's enough history to judge "high".
    high_vol_mask = (vol > threshold).fillna(False)

    filtered = base_positions.copy()
    filtered[high_vol_mask] = 0.0
    return filtered


def full_stack_vol_filtered(price_df: pd.DataFrame) -> pd.Series:
    return vol_filtered_bot(price_df, full_stack_bot)
