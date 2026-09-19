import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.pipeline import run_pipeline


def main():
    parser = argparse.ArgumentParser(description="Run the news-to-trade-idea pipeline.")
    parser.add_argument("--news-limit", type=int, default=20, help="how many recent news items to pull")
    parser.add_argument("--top", type=int, default=10, help="how many top ideas to print")
    parser.add_argument(
        "--fast", action="store_true",
        help="skip Polygon calls entirely (VWAP/OFI/dark pool/GEX/vol skew fall straight to proxy mode) — fast iteration, no rate-limit waits",
    )
    parser.add_argument(
        "--write-alerts", action="store_true",
        help="write take/watch specs into the dashboard's real `alerts` table (dedup'd 24h per asset+title) — off by default, this touches production data",
    )
    parser.add_argument(
        "--write-trades", action="store_true",
        help="write 'take' specs as open paper positions into the dashboard's real `trades` table (one open position per asset at a time) — this is what makes forward validation possible, since backtests can only grade against history that already happened",
    )
    parser.add_argument("--account-size", type=float, default=100_000, help="notional account size for --write-trades sizing_usd (default $100k)")
    args = parser.parse_args()

    specs = run_pipeline(news_limit=args.news_limit, use_polygon=not args.fast)

    if not specs:
        print("No trade ideas generated (no news cleared the impact threshold, or no assets matched).")
        return

    for spec in specs[: args.top]:
        idea = spec.idea
        print("=" * 80)
        print(f"{idea.asset} ({idea.asset_class.value}) — {idea.direction.upper()} — conviction {idea.conviction}/100 — ACTION: {spec.action.upper()}")
        if spec.action == "take":
            print(f"  entry {spec.entry_price} | size {spec.size_pct:.2%} of capital | SL {spec.stop_loss} | TP {spec.take_profit}")
        print(f"  ({spec.rationale})")
        print("-" * 80)
        print(idea.thesis)
        print()

    if args.write_alerts:
        from src.output.alerts_writer import write_trade_specs

        count = write_trade_specs(specs)
        print(f"Wrote {count} new alert(s) to the dashboard's alerts table (deduped against the last {24}h).")

    if args.write_trades:
        from src.output.trades_writer import write_paper_trades

        count = write_paper_trades(specs, account_size=args.account_size)
        print(f"Opened {count} new paper trade(s) in the dashboard's trades table (one open position per asset at a time).")


if __name__ == "__main__":
    main()
