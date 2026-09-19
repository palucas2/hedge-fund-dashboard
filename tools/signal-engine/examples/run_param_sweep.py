import sys
import warnings
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
warnings.filterwarnings("ignore")

import pandas as pd

from tournament.data_loader import load_daily_history
from tournament.param_sweep import robustness_summary, sweep_rsi, sweep_sma

SYMBOLS = ["SPY", "AAPL", "TLT"]
DEFAULT_SMA = (50, 200)
DEFAULT_RSI = (14, 30, 70)


def rank_note(sweep_df: pd.DataFrame, sort_col: str, default_mask) -> str:
    ranked = sweep_df.dropna(subset=["sharpe_ratio"]).sort_values("sharpe_ratio", ascending=False).reset_index(drop=True)
    default_rows = ranked[default_mask(ranked)]
    if default_rows.empty:
        return "default combo produced no valid Sharpe (NaN) for this asset"
    rank = default_rows.index[0] + 1
    return f"default ranks #{rank} of {len(ranked)} combos by Sharpe (Sharpe={default_rows.iloc[0]['sharpe_ratio']:.3f})"


def main():
    all_sma = []
    all_rsi = []

    for symbol in SYMBOLS:
        print(f"\n### {symbol} ###")
        price_df = load_daily_history(symbol, period="10y")
        if price_df.empty or len(price_df) < 300:
            print(f"  skipping {symbol}: insufficient history")
            continue

        sma_df = sweep_sma(price_df)
        sma_df["symbol"] = symbol
        all_sma.append(sma_df)
        print("\n-- SMA crossover sweep --")
        print(sma_df[["fast", "slow", "total_return_pct", "sharpe_ratio", "max_drawdown_pct", "total_trades"]].to_string(index=False))
        print(rank_note(sma_df, "sharpe_ratio", lambda df: (df["fast"] == DEFAULT_SMA[0]) & (df["slow"] == DEFAULT_SMA[1])))

        rsi_df = sweep_rsi(price_df)
        rsi_df["symbol"] = symbol
        all_rsi.append(rsi_df)
        print("\n-- RSI mean-reversion sweep --")
        print(rsi_df[["period", "oversold", "overbought", "total_return_pct", "sharpe_ratio", "max_drawdown_pct", "total_trades"]].to_string(index=False))
        print(rank_note(
            rsi_df, "sharpe_ratio",
            lambda df: (df["period"] == DEFAULT_RSI[0]) & (df["oversold"] == DEFAULT_RSI[1]) & (df["overbought"] == DEFAULT_RSI[2]),
        ))

    sma_all = pd.concat(all_sma, ignore_index=True)
    rsi_all = pd.concat(all_rsi, ignore_index=True)

    sma_summary = robustness_summary(sma_all)
    rsi_summary = robustness_summary(rsi_all)

    print("\n=== Robustness summary (across all symbols x param combos) ===")
    print("SMA crossover:", sma_summary)
    print("RSI mean-reversion:", rsi_summary)

    print("\n=== Verdict ===")
    for name, summary in [("SMA crossover (default 50/200)", sma_summary), ("RSI mean-reversion (default 14/30/70)", rsi_summary)]:
        if summary["n_valid_sharpe"] == 0:
            print(f"{name}: no valid Sharpe values, cannot assess.")
            continue
        spread = summary["sharpe_max"] - summary["sharpe_min"]
        if summary["positive_sharpe_fraction"] < 0.5:
            verdict = "FRAGILE — most nearby parameter choices lose money; the default's result looks like noise, not a real edge."
        elif spread > 1.5:
            verdict = "MIXED — some parameter choices work, others don't; performance is sensitive to the exact setting, so don't trust one combo's backtest number."
        else:
            verdict = "ROBUST-ish — most nearby parameter choices land in a similar range, so the default isn't obviously cherry-picked."
        print(f"{name}: {verdict} (positive_sharpe_fraction={summary['positive_sharpe_fraction']:.2f}, sharpe_range={spread:.2f})")


if __name__ == "__main__":
    main()
