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
    args = parser.parse_args()

    ideas = run_pipeline(news_limit=args.news_limit, use_polygon=not args.fast)

    if not ideas:
        print("No trade ideas generated (no news cleared the impact threshold, or no assets matched).")
        return

    for idea in ideas[: args.top]:
        print("=" * 80)
        print(f"{idea.asset} ({idea.asset_class.value}) — {idea.direction.upper()} — conviction {idea.conviction}/100")
        print("-" * 80)
        print(idea.thesis)
        print()


if __name__ == "__main__":
    main()
