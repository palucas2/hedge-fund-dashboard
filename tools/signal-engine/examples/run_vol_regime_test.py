"""Does forcing full_stack flat during high-realized-vol stretches help or hurt?
Backtests full_stack vs full_stack_vol_filtered side by side on real data and
prints both directions honestly — filtering out chop can also mean missing the
big trending moves, which often happen during high-vol stretches too."""

import sys
import warnings
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
warnings.filterwarnings("ignore")

import pandas as pd

from tournament.bots import full_stack_bot
from tournament.data_loader import load_daily_history
from tournament.engine import backtest_bot
from tournament.vol_regime_bot import full_stack_vol_filtered

SYMBOLS = ["SPY", "AAPL", "TLT", "BTC-USD"]


def main():
    rows = []
    for symbol in SYMBOLS:
        price_df = load_daily_history(symbol, period="5y")
        if price_df.empty or len(price_df) < 300:
            print(f"  skipping {symbol}: insufficient history ({len(price_df)} rows)")
            continue

        base = backtest_bot(price_df, full_stack_bot)
        filtered = backtest_bot(price_df, full_stack_vol_filtered)

        rows.append({"symbol": symbol, "variant": "full_stack", **base})
        rows.append({"symbol": symbol, "variant": "full_stack_vol_filtered", **filtered})

    df = pd.DataFrame(rows)
    cols = ["symbol", "variant", "total_return_pct", "sharpe_ratio", "max_drawdown_pct", "win_rate_pct", "total_trades"]
    print(df[cols].to_string(index=False))

    print("\n=== Filtered vs base, per symbol ===")
    for symbol in df["symbol"].unique():
        sub = df[df["symbol"] == symbol]
        base_row = sub[sub["variant"] == "full_stack"].iloc[0]
        filt_row = sub[sub["variant"] == "full_stack_vol_filtered"].iloc[0]
        d_sharpe = filt_row["sharpe_ratio"] - base_row["sharpe_ratio"]
        d_dd = filt_row["max_drawdown_pct"] - base_row["max_drawdown_pct"]
        d_trades = filt_row["total_trades"] - base_row["total_trades"]
        verdict = "HELPED" if d_sharpe > 0 else "HURT" if d_sharpe < 0 else "NO CHANGE"
        print(
            f"{symbol}: Sharpe {base_row['sharpe_ratio']:.3f} -> {filt_row['sharpe_ratio']:.3f} "
            f"(delta {d_sharpe:+.3f}), max_dd delta {d_dd:+.2f}pp, trades delta {d_trades:+d}  [{verdict}]"
        )


if __name__ == "__main__":
    main()
