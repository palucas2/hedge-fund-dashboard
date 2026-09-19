"""Sweeps the sizing/stop parameters actually used in production (src/
idea_generator/sizing.py, via tournament/sized_backtest.py) to check whether
the defaults in config.py are reasonable or just an untested guess — same
motivation as param_sweep.py for the SMA/RSI bots, applied to the trade
construction layer instead."""

from __future__ import annotations

import pandas as pd

from tournament.data_loader import load_daily_history
from tournament.engine import split_windows
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


def sweep_stops_multi_asset_window(
    symbols: list[str],
    period: str = "10y",
    n_windows: int = 2,
    stop_options: list[float] = [1.0, 1.5, 2.0, 3.0, 4.0],
    target_options: list[float] = [2.0, 3.0, 4.0, 6.0],
) -> pd.DataFrame:
    """Same sweep as sweep_stops, but across several assets AND split into
    non-overlapping time windows — the config.py update on Sept 19 was based
    on 3 assets / 1 window, which the README flagged as thin evidence. This is
    the wider check: every (symbol, window, stop, target) combo in one table,
    so a ranking can be built the same way tournament/engine.py's leaderboard
    is (average Sharpe + consistency_pct), not a single asset's best combo."""
    rows = []
    for symbol in symbols:
        full_df = load_daily_history(symbol, period=period)
        if full_df.empty or len(full_df) < 200:
            continue
        for window_label, window_df in split_windows(full_df, n_windows):
            if len(window_df) < 100:
                continue
            for stop_mult in stop_options:
                for target_mult in target_options:
                    result = backtest_sized_full_stack(window_df, stop_multiplier=stop_mult, target_multiplier=target_mult)
                    rows.append(
                        {"symbol": symbol, "window": window_label, "stop_multiplier": stop_mult, "target_multiplier": target_mult, **result}
                    )
    return pd.DataFrame(rows)


def leaderboard_by_combo(results: pd.DataFrame) -> pd.DataFrame:
    agg = results.groupby(["stop_multiplier", "target_multiplier"]).agg(
        avg_sharpe=("sharpe_ratio", "mean"),
        avg_return_pct=("total_return_pct", "mean"),
        avg_max_drawdown_pct=("max_drawdown_pct", "mean"),
        combos_tested=("symbol", "count"),
    )
    positive_share = results.groupby(["stop_multiplier", "target_multiplier"])["sharpe_ratio"].apply(lambda s: (s > 0).mean() * 100)
    agg["consistency_pct"] = positive_share
    return agg.sort_values("avg_sharpe", ascending=False)
