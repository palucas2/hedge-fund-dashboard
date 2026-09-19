"""Sweeps the sizing/stop parameters actually used in production (src/
idea_generator/sizing.py, via tournament/sized_backtest.py) to check whether
the defaults in config.py are reasonable or just an untested guess — same
motivation as param_sweep.py for the SMA/RSI bots, applied to the trade
construction layer instead."""

from __future__ import annotations

import pandas as pd

from tournament.sized_backtest import backtest_sized_full_stack


def sweep_stops(
    price_df: pd.DataFrame,
    stop_options: list[float] = [1.0, 1.5, 2.0, 3.0, 4.0],
    target_options: list[float] = [2.0, 3.0, 4.0, 6.0],
) -> pd.DataFrame:
    rows = []
    for stop_mult in stop_options:
        for target_mult in target_options:
            result = backtest_sized_full_stack(price_df, stop_multiplier=stop_mult, target_multiplier=target_mult)
            rows.append({"stop_multiplier": stop_mult, "target_multiplier": target_mult, **result})
    return pd.DataFrame(rows)


def sweep_target_vol(price_df: pd.DataFrame, target_vol_options: list[float] = [0.08, 0.12, 0.15, 0.20, 0.30]) -> pd.DataFrame:
    rows = []
    for tv in target_vol_options:
        result = backtest_sized_full_stack(price_df, target_annual_vol=tv)
        rows.append({"target_annual_vol": tv, **result})
    return pd.DataFrame(rows)
