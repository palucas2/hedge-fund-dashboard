import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tournament.data_loader import load_daily_history
from tournament.sizing_sweep import sweep_stops, sweep_target_vol

DEFAULT_SYMBOLS = ["SPY", "AAPL", "TLT"]


def main():
    parser = argparse.ArgumentParser(description="Sweep stop/target multipliers and target-vol for the sized backtest.")
    parser.add_argument("--symbols", nargs="+", default=DEFAULT_SYMBOLS)
    parser.add_argument("--period", default="5y")
    args = parser.parse_args()

    for symbol in args.symbols:
        price_df = load_daily_history(symbol, period=args.period)
        if price_df.empty or len(price_df) < 100:
            print(f"skipping {symbol}: insufficient history")
            continue

        print(f"\n=== {symbol}: stop/target multiplier sweep ===")
        stops = sweep_stops(price_df)
        print(stops.sort_values("sharpe_ratio", ascending=False).to_string(index=False))

        print(f"\n=== {symbol}: target-vol sweep (stop/target multipliers at config default) ===")
        tv = sweep_target_vol(price_df)
        print(tv.sort_values("sharpe_ratio", ascending=False).to_string(index=False))


if __name__ == "__main__":
    main()
