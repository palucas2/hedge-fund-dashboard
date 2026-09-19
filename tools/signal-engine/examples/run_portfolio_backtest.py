import argparse
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
warnings.filterwarnings("ignore")

from tournament.bots import BOTS, buy_and_hold
from tournament.data_loader import load_daily_history
from tournament.portfolio_bots import combine_portfolio, vol_target_position

TRADING_DAYS_PER_YEAR = 252

DEFAULT_SYMBOLS = ["SPY", "TLT", "GLD", "BTC-USD", "AAPL"]


def equity_stats(equity: pd.Series) -> dict:
    returns = equity.pct_change().dropna()
    if returns.std() == 0 or len(returns) < 2:
        sharpe = 0.0
    else:
        sharpe = float(returns.mean() / returns.std() * np.sqrt(TRADING_DAYS_PER_YEAR))
    total_return_pct = float((equity.iloc[-1] / equity.iloc[0] - 1.0) * 100)
    drawdown = equity / equity.cummax() - 1.0
    max_drawdown_pct = float(drawdown.min() * 100)
    return {"total_return_pct": total_return_pct, "sharpe_ratio": sharpe, "max_drawdown_pct": max_drawdown_pct}


def main():
    parser = argparse.ArgumentParser(description="Portfolio-level backtest: vol-targeted positions across several assets, combined.")
    parser.add_argument("--symbols", nargs="+", default=DEFAULT_SYMBOLS)
    parser.add_argument("--bot", default="full_stack", choices=list(BOTS.keys()))
    parser.add_argument("--period", default="5y")
    parser.add_argument("--target-vol", type=float, default=0.15, help="target annualized volatility per asset leg")
    args = parser.parse_args()

    bot_fn = BOTS[args.bot]

    print(f"Loading {len(args.symbols)} assets over {args.period}...")
    asset_prices = {}
    for symbol in args.symbols:
        df = load_daily_history(symbol, period=args.period)
        if df.empty or len(df) < 100:
            print(f"  skipping {symbol}: insufficient history")
            continue
        asset_prices[symbol] = df
    symbols = list(asset_prices.keys())

    print(f"Computing vol-targeted '{args.bot}' positions (target_annual_vol={args.target_vol})...")
    vol_targeted_positions = {
        s: vol_target_position(asset_prices[s], bot_fn, target_annual_vol=args.target_vol) for s in symbols
    }
    raw_positions = {s: bot_fn(asset_prices[s]) for s in symbols}
    bh_positions = {s: buy_and_hold(asset_prices[s]) for s in symbols}

    vol_targeted_equity = combine_portfolio(vol_targeted_positions, asset_prices)
    raw_equity = combine_portfolio(raw_positions, asset_prices)
    bh_equity = combine_portfolio(bh_positions, asset_prices)

    print(f"\n=== Portfolio results: {symbols} ===\n")
    for label, equity in [
        (f"{args.bot} (vol-targeted)", vol_targeted_equity),
        (f"{args.bot} (raw, unsized)", raw_equity),
        ("buy_and_hold (equal-weight)", bh_equity),
    ]:
        stats = equity_stats(equity)
        print(
            f"{label:32s}  return={stats['total_return_pct']:8.2f}%  "
            f"sharpe={stats['sharpe_ratio']:6.2f}  max_dd={stats['max_drawdown_pct']:7.2f}%"
        )


if __name__ == "__main__":
    main()
