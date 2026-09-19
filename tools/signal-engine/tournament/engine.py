"""Runs every bot against every asset with vectorbt and ranks the results.
Positions are shifted one bar forward — a signal computed from data through
day t's close is only actionable starting day t+1, never traded into the same
bar that produced it.

Split-window evaluation exists because a single backtest window is a sample
size of one: a bot that tops the leaderboard on 2021-2026 might just have
gotten lucky with that particular stretch of market history. Fetching a long
history and splitting it into non-overlapping windows (e.g. 2016-2021 vs
2021-2026) lets a bot's ranking be checked for consistency instead of taken
on faith from one run.
"""

from __future__ import annotations

import warnings

import pandas as pd
import vectorbt as vbt

from tournament.bots import BOTS
from tournament.data_loader import load_daily_history

warnings.filterwarnings("ignore")

# 5bps/trade round-trip-ish — without this, high-turnover bots (300-600 trades
# over 5y) show backtested Sharpe that no real broker/spread would let you keep.
DEFAULT_FEES = 0.0005


def backtest_bot(price_df: pd.DataFrame, position_fn, freq: str = "1D", fees: float = DEFAULT_FEES) -> dict:
    positions = position_fn(price_df).shift(1).fillna(0.0)
    close = price_df["close"]

    pf = vbt.Portfolio.from_orders(close, size=positions, size_type="targetpercent", fees=fees, freq=freq)
    stats = pf.stats()

    return {
        "total_return_pct": float(stats["Total Return [%]"]),
        "benchmark_return_pct": float(stats["Benchmark Return [%]"]),
        "sharpe_ratio": float(stats["Sharpe Ratio"]) if pd.notna(stats["Sharpe Ratio"]) else None,
        "max_drawdown_pct": float(stats["Max Drawdown [%]"]),
        "win_rate_pct": float(stats["Win Rate [%]"]) if pd.notna(stats["Win Rate [%]"]) else None,
        "total_trades": int(stats["Total Trades"]),
    }


def split_windows(price_df: pd.DataFrame, n_windows: int = 2) -> list[tuple[str, pd.DataFrame]]:
    """Split into n_windows non-overlapping, chronologically-ordered chunks."""
    n = len(price_df)
    chunk = n // n_windows
    windows = []
    for w in range(n_windows):
        start = w * chunk
        end = n if w == n_windows - 1 else (w + 1) * chunk
        chunk_df = price_df.iloc[start:end]
        label = f"{chunk_df.index[0].date()}..{chunk_df.index[-1].date()}"
        windows.append((label, chunk_df))
    return windows


def run_tournament(
    symbols: list[str], period: str = "10y", n_windows: int = 2, fees: float = DEFAULT_FEES
) -> pd.DataFrame:
    rows = []

    for symbol in symbols:
        full_df = load_daily_history(symbol, period=period)
        if full_df.empty or len(full_df) < 200:
            print(f"  skipping {symbol}: insufficient history ({len(full_df)} rows)")
            continue

        for window_label, window_df in split_windows(full_df, n_windows):
            if len(window_df) < 100:
                continue
            for bot_name, bot_fn in BOTS.items():
                try:
                    result = backtest_bot(window_df, bot_fn, fees=fees)
                except Exception as e:
                    print(f"  {symbol}/{bot_name}/{window_label} failed: {e}")
                    continue
                result["symbol"] = symbol
                result["bot"] = bot_name
                result["window"] = window_label
                rows.append(result)

    df = pd.DataFrame(rows)
    cols = ["bot", "symbol", "window", "total_return_pct", "benchmark_return_pct", "sharpe_ratio", "max_drawdown_pct", "win_rate_pct", "total_trades"]
    return df[cols]


def leaderboard(results: pd.DataFrame) -> pd.DataFrame:
    """Ranked by average Sharpe across every (asset, window) combo — but
    consistency_pct (share of asset/window combos with positive Sharpe) is the
    column that actually separates a robust bot from one that got carried by a
    single good window on a single asset."""
    agg = results.groupby("bot").agg(
        avg_return_pct=("total_return_pct", "mean"),
        avg_sharpe=("sharpe_ratio", "mean"),
        avg_max_drawdown_pct=("max_drawdown_pct", "mean"),
        avg_win_rate_pct=("win_rate_pct", "mean"),
        combos_tested=("symbol", "count"),
    )
    positive_share = results.groupby("bot")["sharpe_ratio"].apply(lambda s: (s > 0).mean() * 100)
    agg["consistency_pct"] = positive_share
    return agg.sort_values("avg_sharpe", ascending=False)
