import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tournament.engine import leaderboard, run_tournament

DEFAULT_SYMBOLS = ["SPY", "AAPL", "GLD", "TLT", "BTC-USD"]


def main():
    parser = argparse.ArgumentParser(description="Backtest tournament: every bot vs every asset.")
    parser.add_argument("--symbols", nargs="+", default=DEFAULT_SYMBOLS)
    parser.add_argument("--period", default="5y", help="yfinance period, e.g. 2y, 5y, 10y, max")
    args = parser.parse_args()

    print(f"Running tournament: {len(args.symbols)} assets x 5 bots over {args.period}...")
    results = run_tournament(args.symbols, period=args.period)

    print("\n=== Per asset/bot results ===")
    print(results.to_string(index=False))

    print("\n=== Leaderboard (averaged across assets, ranked by Sharpe) ===")
    print(leaderboard(results).to_string())


if __name__ == "__main__":
    main()
