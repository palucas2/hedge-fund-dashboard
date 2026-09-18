"""Scores a NewsEvent 0-100 on how much it's likely to move financial markets.

Four components, each capped, summed to 100:
  - sentiment magnitude   (0-40): how strongly positive/negative Alpha Vantage rates it
  - breadth               (0-20): how many tickers AV tagged as relevant (wide vs. narrow impact)
  - topic weight          (0-20): presence of macro-moving topics (rates, fiscal, geopolitics...)
  - keyword shock terms   (0-20): regex hits on words that historically precede big moves

Events with no AV sentiment (e.g. from NewsAPI) skip the sentiment-magnitude
component and lean more on keywords for both score and direction.
"""

import re

from src.models.schemas import ImpactScore, NewsEvent

HIGH_IMPACT_TOPICS = {
    "economy_monetary",
    "economy_macro",
    "economy_fiscal",
    "financial_markets",
    "mergers_and_acquisitions",
    "energy_transportation",
}

SHOCK_KEYWORDS = [
    "war", "invasion", "sanction", "embargo", "blockade", "ceasefire", "missile",
    "strike", "attack", "nuclear", "coup", "default", "bankruptcy", "recession",
    "rate hike", "rate cut", "fomc", "fed ", "ecb", "boj", "tariff", "shutdown",
    "downgrade", "upgrade", "opec", "emergency", "crisis", "collapse", "plunge",
    "surge", "soar", "crash", "halt", "conflict",
]

BULLISH_WORDS = {"rally", "surge", "soar", "beat", "upgrade", "ceasefire", "cut rates", "stimulus"}
BEARISH_WORDS = {"plunge", "crash", "collapse", "downgrade", "default", "war", "sanction", "recession", "shutdown"}


def _sentiment_component(event: NewsEvent) -> float:
    if event.raw_sentiment is None:
        return 0.0
    return min(abs(event.raw_sentiment), 1.0) * 40


def _breadth_component(event: NewsEvent) -> float:
    return min(len(event.tagged_tickers), 10) / 10 * 20


def _topic_component(event: NewsEvent) -> float:
    hits = sum(1 for t in event.topics if t in HIGH_IMPACT_TOPICS)
    return min(hits, 3) / 3 * 20


def _keyword_component(text: str) -> tuple[float, list[str]]:
    hits = [kw for kw in SHOCK_KEYWORDS if kw in text]
    score = min(len(hits), 5) / 5 * 20
    return score, hits


def _infer_direction(event: NewsEvent, text: str) -> str:
    if event.raw_sentiment is not None:
        if event.raw_sentiment >= 0.15:
            return "bullish"
        if event.raw_sentiment <= -0.15:
            return "bearish"
        return "neutral"

    bull_hits = sum(1 for w in BULLISH_WORDS if w in text)
    bear_hits = sum(1 for w in BEARISH_WORDS if w in text)
    if bull_hits > bear_hits:
        return "bullish"
    if bear_hits > bull_hits:
        return "bearish"
    return "neutral"


def score_news(event: NewsEvent) -> ImpactScore:
    text = f"{event.title} {event.summary}".lower()

    sentiment_pts = _sentiment_component(event)
    breadth_pts = _breadth_component(event)
    topic_pts = _topic_component(event)
    keyword_pts, keyword_hits = _keyword_component(text)

    total = round(min(sentiment_pts + breadth_pts + topic_pts + keyword_pts, 100))

    rationale = []
    if sentiment_pts:
        rationale.append(f"AV sentiment magnitude {abs(event.raw_sentiment):.2f} -> {sentiment_pts:.0f}/40 pts")
    if breadth_pts:
        rationale.append(f"{len(event.tagged_tickers)} tickers tagged -> {breadth_pts:.0f}/20 pts")
    if topic_pts:
        rationale.append(f"high-impact topics matched -> {topic_pts:.0f}/20 pts")
    if keyword_hits:
        rationale.append(f"shock keywords {keyword_hits} -> {keyword_pts:.0f}/20 pts")
    if not rationale:
        rationale.append("no strong signal on any component")

    return ImpactScore(
        news_id=event.id,
        score=total,
        direction=_infer_direction(event, text),
        rationale=rationale,
    )
