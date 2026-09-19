"""Polling loop: news -> score -> signals -> trade spec -> alerts table, every
--interval seconds. No dedicated cron infra needed — same pattern the Next.js
dashboard's own Module 9 already uses (poll on an interval, dedupe in the DB),
just running from this side instead of a browser tab.

One cycle failing (a bad API response, a transient DB hiccup) never kills the
loop — every cycle is wrapped, logged, and the loop moves on to the next one.
"""

import argparse
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.output.alerts_writer import write_trade_specs
from src.pipeline import run_pipeline


def run_cycle(news_limit: int, use_polygon: bool) -> None:
    started = datetime.now()
    specs = run_pipeline(news_limit=news_limit, use_polygon=use_polygon)
    taken = sum(1 for s in specs if s.action == "take")
    watched = sum(1 for s in specs if s.action == "watch")

    written = write_trade_specs(specs)

    elapsed = (datetime.now() - started).total_seconds()
    print(
        f"[{started:%Y-%m-%d %H:%M:%S}] cycle done in {elapsed:.1f}s — "
        f"{len(specs)} ideas ({taken} take, {watched} watch) — {written} new alerts written"
    )


def main():
    parser = argparse.ArgumentParser(description="Run the pipeline on a polling loop, writing alerts each cycle.")
    parser.add_argument("--interval", type=int, default=900, help="seconds between cycles (default 900 = 15min)")
    parser.add_argument("--news-limit", type=int, default=20)
    parser.add_argument("--fast", action="store_true", help="skip Polygon calls (see run_pipeline.py --fast)")
    parser.add_argument("--cycles", type=int, default=0, help="stop after N cycles (0 = run forever)")
    args = parser.parse_args()

    print(f"Starting daemon: every {args.interval}s, news_limit={args.news_limit}, fast={args.fast}")
    count = 0
    while True:
        try:
            run_cycle(args.news_limit, use_polygon=not args.fast)
        except Exception as e:
            print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] cycle failed: {e!r} — continuing")

        count += 1
        if args.cycles and count >= args.cycles:
            print(f"Ran {count} cycle(s), stopping (--cycles limit reached).")
            break

        time.sleep(args.interval)


if __name__ == "__main__":
    main()
