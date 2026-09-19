import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tournament.data_loader import load_daily_history
from tournament.engine import backtest_bot, DEFAULT_FEES
from tournament.bots import full_stack_bot
from tournament.sized_backtest import backtest_sized_full_stack

DEFAULT_SYMBOLS = ["SPY", "AAPL", "GLD", "TLT", "BTC-USD"]


def main():
    parser = argparse.ArgumentParser(description="Compare full_stack raw (fixed sizing, no stops) vs. the real trade_builder sizing/stop formula.")
    parser.add_argument("--symbols", nargs="+", default=DEFAULT_SYMBOLS)
    parser.add_argument("--period", default="5y")
    args = parser.parse_args()

    print(f"{'symbol':10s} {'variant':22s} {'return%':>10s} {'sharpe':>8s} {'maxdd%':>8s} {'trades':>7s}")
    for symbol in args.symbols:
        price_df = load_daily_history(symbol, period=args.period)
        if price_df.empty or len(price_df) < 100:
            print(f"  skipping {symbol}: insufficient history")
            continue

        raw = backtest_bot(price_df, full_stack_bot, fees=DEFAULT_FEES)
        sized = backtest_sized_full_stack(price_df)

        print(f"{symbol:10s} {'full_stack raw':22s} {raw['total_return_pct']:>10.2f} {raw['sharpe_ratio']:>8.3f} {raw['max_drawdown_pct']:>8.2f} {raw['total_trades']:>7d}")
        sharpe_str = f"{sized['sharpe_ratio']:.3f}" if sized["sharpe_ratio"] is not None else "n/a"
        print(f"{symbol:10s} {'full_stack sized+stops':22s} {sized['total_return_pct']:>10.2f} {sharpe_str:>8s} {sized['max_drawdown_pct']:>8.2f} {sized['trade_count']:>7d}")


if __name__ == "__main__":
    main()
