import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tournament.bots import BOTS
from tournament.engine import DEFAULT_FEES, leaderboard, run_tournament

DEFAULT_SYMBOLS = [
    "AAPL", "MSFT", "NVDA", "XOM", "JPM",       # stocks
    "SPY", "QQQ", "XLE", "XLF",                 # ETFs
    "GLD", "USO", "UNG",                        # commodities (ETF proxy)
    "TLT", "IEF",                                # bonds
    "BTC-USD", "ETH-USD",                        # crypto
]


def main():
    parser = argparse.ArgumentParser(description="Backtest tournament: every bot vs every asset, split into non-overlapping windows.")
    parser.add_argument("--symbols", nargs="+", default=DEFAULT_SYMBOLS)
    parser.add_argument("--period", default="10y", help="yfinance period, e.g. 5y, 10y, max")
    parser.add_argument("--windows", type=int, default=2, help="non-overlapping windows to split history into")
    parser.add_argument("--fees", type=float, default=DEFAULT_FEES, help="per-trade fee as a fraction, e.g. 0.0005 = 5bps")
    args = parser.parse_args()

    print(f"Running tournament: {len(args.symbols)} assets x {len(BOTS)} bots x {args.windows} windows over {args.period} (fees={args.fees})...")
    results = run_tournament(args.symbols, period=args.period, n_windows=args.windows, fees=args.fees)

    print("\n=== Per asset/bot/window results ===")
    print(results.to_string(index=False))

    print("\n=== Leaderboard (ranked by avg Sharpe; consistency_pct = share of asset/window combos with positive Sharpe) ===")
    print(leaderboard(results).to_string())


if __name__ == "__main__":
    main()
