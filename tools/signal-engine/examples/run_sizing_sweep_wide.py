import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tournament.sizing_sweep import leaderboard_by_combo, sweep_stops_multi_asset_window

DEFAULT_SYMBOLS = ["SPY", "AAPL", "TLT", "GLD", "QQQ", "BTC-USD"]


def main():
    parser = argparse.ArgumentParser(description="Wide sizing/stop sweep: multiple assets x multiple time windows.")
    parser.add_argument("--symbols", nargs="+", default=DEFAULT_SYMBOLS)
    parser.add_argument("--period", default="10y")
    parser.add_argument("--windows", type=int, default=2)
    args = parser.parse_args()

    print(f"Sweeping {len(args.symbols)} assets x {args.windows} windows x 20 stop/target combos...")
    results = sweep_stops_multi_asset_window(args.symbols, period=args.period, n_windows=args.windows)

    print(f"\n{len(results)} total (symbol, window, combo) results")
    print("\n=== Leaderboard by (stop_multiplier, target_multiplier), ranked by avg Sharpe ===")
    print(leaderboard_by_combo(results).to_string())

    results.to_csv("sizing_sweep_wide_results.csv", index=False)
    print("\nFull results saved to sizing_sweep_wide_results.csv")


if __name__ == "__main__":
    main()
