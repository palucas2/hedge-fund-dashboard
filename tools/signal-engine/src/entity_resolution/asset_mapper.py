"""Maps a NewsEvent to the assets it's likely to move.

Two passes:
  1. Direct hits — tickers Alpha Vantage already tagged with a relevance score.
     Most reliable path; used as-is.
  2. Keyword hits — scan title+summary against the asset universe's keyword list
     to catch commodities, bonds, FX and thematic ETFs that AV's ticker tagging
     doesn't cover (it only tags listed equities/ETFs it recognizes).
"""

from src.entity_resolution.asset_universe import load_universe
from src.models.schemas import AssetHit, NewsEvent

KEYWORD_HIT_RELEVANCE = 0.5


def map_news_to_assets(event: NewsEvent, max_assets: int = 15) -> list[AssetHit]:
    universe = load_universe()
    hits: dict[str, AssetHit] = {}

    for ticker, relevance in event.tagged_tickers.items():
        row = universe[universe["symbol"].str.upper() == ticker.upper()]
        if not row.empty:
            r = row.iloc[0]
            hits[ticker.upper()] = AssetHit(
                symbol=r["symbol"], name=r["name"], asset_class=r["asset_class"], relevance=float(relevance)
            )
        else:
            # AV tagged a ticker outside our seed universe — still worth surfacing
            hits[ticker.upper()] = AssetHit(
                symbol=ticker.upper(), name=ticker.upper(), asset_class="stock", relevance=float(relevance)
            )

    text = f"{event.title} {event.summary}".lower()
    for _, row in universe.iterrows():
        symbol = row["symbol"]
        if symbol.upper() in hits:
            continue
        keyword_matches = sum(1 for kw in row["keywords"] if kw in text)
        if keyword_matches:
            hits[symbol.upper()] = AssetHit(
                symbol=symbol,
                name=row["name"],
                asset_class=row["asset_class"],
                relevance=min(KEYWORD_HIT_RELEVANCE + 0.1 * (keyword_matches - 1), 1.0),
            )

    ranked = sorted(hits.values(), key=lambda h: h.relevance, reverse=True)
    return ranked[:max_assets]
