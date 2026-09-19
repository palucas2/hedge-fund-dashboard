"""Parameter-robustness check for the parameter-driven bots (SMA crossover, RSI
mean-reversion). One hand-picked parameter set (e.g. SMA 50/200) can look great
purely by chance — the real question is whether *nearby* parameter choices also
work, or whether performance collapses a few days off the chosen values. A bot
that's only good at one exact setting is fit to noise, not a real edge.
"""

from __future__ import annotations

import itertools

import pandas as pd

from tournament.bots import rsi_mean_reversion_bot, sma_crossover_bot
from tournament.engine import backtest_bot


def sweep_sma(
    price_df: pd.DataFrame,
    fast_options: list[int] = [20, 50, 100],
    slow_options: list[int] = [100, 200, 300],
) -> pd.DataFrame:
    rows = []
    for fast, slow in itertools.product(fast_options, slow_options):
        if fast >= slow:
            continue
        try:
            stats = backtest_bot(price_df, lambda df, f=fast, s=slow: sma_crossover_bot(df, fast=f, slow=s))
        except Exception as e:
            stats = {"error": str(e)}
        stats["fast"] = fast
        stats["slow"] = slow
        rows.append(stats)
    return pd.DataFrame(rows)


def sweep_rsi(
    price_df: pd.DataFrame,
    period_options: list[int] = [7, 14, 21],
    oversold_options: list[float] = [20, 30],
    overbought_options: list[float] = [70, 80],
) -> pd.DataFrame:
    rows = []
    for period, oversold, overbought in itertools.product(period_options, oversold_options, overbought_options):
        try:
            stats = backtest_bot(
                price_df,
                lambda df, p=period, os=oversold, ob=overbought: rsi_mean_reversion_bot(
                    df, period=p, oversold=os, overbought=ob
                ),
            )
        except Exception as e:
            stats = {"error": str(e)}
        stats["period"] = period
        stats["oversold"] = oversold
        stats["overbought"] = overbought
        rows.append(stats)
    return pd.DataFrame(rows)


def robustness_summary(sweep_df: pd.DataFrame) -> dict:
    sharpe = sweep_df["sharpe_ratio"].dropna()
    if sharpe.empty:
        return {
            "n_combos": len(sweep_df),
            "n_valid_sharpe": 0,
            "positive_sharpe_fraction": None,
            "sharpe_min": None,
            "sharpe_max": None,
            "sharpe_mean": None,
            "sharpe_std": None,
        }
    return {
        "n_combos": len(sweep_df),
        "n_valid_sharpe": len(sharpe),
        "positive_sharpe_fraction": float((sharpe > 0).mean()),
        "sharpe_min": float(sharpe.min()),
        "sharpe_max": float(sharpe.max()),
        "sharpe_mean": float(sharpe.mean()),
        "sharpe_std": float(sharpe.std()),
    }
