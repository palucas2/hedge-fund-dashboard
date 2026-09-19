"""Runs every bot against every asset with vectorbt and ranks the results.
Positions are shifted one bar forward — a signal computed from data through
day t's close is only actionable starting day t+1, never traded into the same
bar that produced it."""

from __future__ import annotations

import warnings

import pandas as pd
import vectorbt as vbt

from tournament.bots import BOTS
from tournament.data_loader import load_daily_history

warnings.filterwarnings("ignore")


def backtest_bot(price_df: pd.DataFrame, position_fn, freq: str = "1D") -> dict:
    positions = position_fn(price_df).shift(1).fillna(0.0)
    close = price_df["close"]

    pf = vbt.Portfolio.from_orders(close, size=positions, size_type="targetpercent", freq=freq)
    stats = pf.stats()

    return {
        "total_return_pct": float(stats["Total Return [%]"]),
        "benchmark_return_pct": float(stats["Benchmark Return [%]"]),
        "sharpe_ratio": float(stats["Sharpe Ratio"]) if pd.notna(stats["Sharpe Ratio"]) else None,
        "max_drawdown_pct": float(stats["Max Drawdown [%]"]),
        "win_rate_pct": float(stats["Win Rate [%]"]) if pd.notna(stats["Win Rate [%]"]) else None,
        "total_trades": int(stats["Total Trades"]),
    }


def run_tournament(symbols: list[str], period: str = "5y") -> pd.DataFrame:
    rows = []

    for symbol in symbols:
        price_df = load_daily_history(symbol, period=period)
        if price_df.empty or len(price_df) < 100:
            print(f"  skipping {symbol}: insufficient history ({len(price_df)} rows)")
            continue

        for bot_name, bot_fn in BOTS.items():
            try:
                result = backtest_bot(price_df, bot_fn)
            except Exception as e:
                print(f"  {symbol}/{bot_name} failed: {e}")
                continue
            result["symbol"] = symbol
            result["bot"] = bot_name
            rows.append(result)

    df = pd.DataFrame(rows)
    return df[["bot", "symbol", "total_return_pct", "benchmark_return_pct", "sharpe_ratio", "max_drawdown_pct", "win_rate_pct", "total_trades"]]


def leaderboard(results: pd.DataFrame) -> pd.DataFrame:
    """Average each bot's stats across all assets it was tested on — the ranking
    that matters for picking a bot, not any single asset's result."""
    agg = results.groupby("bot").agg(
        avg_return_pct=("total_return_pct", "mean"),
        avg_sharpe=("sharpe_ratio", "mean"),
        avg_max_drawdown_pct=("max_drawdown_pct", "mean"),
        avg_win_rate_pct=("win_rate_pct", "mean"),
        assets_tested=("symbol", "nunique"),
    )
    return agg.sort_values("avg_sharpe", ascending=False)
