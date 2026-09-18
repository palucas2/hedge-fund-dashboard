"""News ingestion. Alpha Vantage NEWS_SENTIMENT is the primary source — it already
tags relevant tickers and gives a sentiment score, which feeds both the impact
scorer and entity resolution. NewsAPI.org is used as a secondary, broader-coverage
source (no built-in ticker tagging or sentiment, so those fields come back empty
and get filled in downstream by our own scorer/mapper).
"""

from __future__ import annotations

import hashlib
from datetime import datetime

import requests

import config
from src.ingestion import cache
from src.models.schemas import NewsEvent

# Short TTL: news is meant to be fresh, this mainly absorbs repeated calls
# during iterative testing/dev without burning the daily request quota.
NEWS_CACHE_TTL_SECONDS = 10 * 60


def _make_id(url: str) -> str:
    return hashlib.sha1(url.encode()).hexdigest()[:16]


def _parse_av_timestamp(ts: str) -> datetime:
    return datetime.strptime(ts, "%Y%m%dT%H%M%S")


def fetch_alpha_vantage_news(
    tickers: str | None = None, topics: str | None = None, limit: int = 50
) -> list[NewsEvent]:
    params = {
        "function": "NEWS_SENTIMENT",
        "apikey": config.ALPHA_VANTAGE_API_KEY,
        "limit": limit,
        "sort": "LATEST",
    }
    if tickers:
        params["tickers"] = tickers
    if topics:
        params["topics"] = topics

    cache_key = ("av_news", tuple(sorted(params.items())))
    payload = cache.read(cache_key, NEWS_CACHE_TTL_SECONDS)

    if payload is None:
        try:
            resp = requests.get(config.ALPHA_VANTAGE_BASE_URL, params=params, timeout=20)
            resp.raise_for_status()
            payload = resp.json()
        except requests.exceptions.RequestException:
            return []  # network hiccup or AV-side error — don't crash the pipeline

        if "feed" in payload:
            cache.write(cache_key, payload)
        else:
            payload = {}  # rate-limit / quota message, not a real feed — don't cache the failure

    feed = payload.get("feed", [])
    events = []
    for item in feed:
        ticker_sentiment = {
            t["ticker"]: float(t["relevance_score"])
            for t in item.get("ticker_sentiment", [])
        }
        topics_list = [t["topic"] for t in item.get("topics", [])]
        events.append(
            NewsEvent(
                id=_make_id(item["url"]),
                title=item.get("title", ""),
                summary=item.get("summary", ""),
                source=item.get("source", "alpha_vantage"),
                url=item.get("url", ""),
                published_at=_parse_av_timestamp(item["time_published"]),
                raw_sentiment=float(item.get("overall_sentiment_score", 0.0)),
                topics=topics_list,
                tagged_tickers=ticker_sentiment,
            )
        )
    return events


FINANCIAL_DOMAINS = (
    "reuters.com,bloomberg.com,cnbc.com,marketwatch.com,wsj.com,ft.com,"
    "investing.com,fool.com,barrons.com,businessinsider.com,forbes.com"
)


def fetch_newsapi_news(
    query: str = "markets OR fed OR inflation OR opec OR earnings OR rate cut OR rate hike OR recession",
    limit: int = 50,
    domains: str = FINANCIAL_DOMAINS,
) -> list[NewsEvent]:
    """`domains` restricts to major financial outlets — without it, NewsAPI's
    'everything' + sortBy=publishedAt surfaces a lot of off-topic noise (sports,
    lifestyle...) that never clears the impact-score threshold anyway."""
    if not config.NEWS_API_KEY:
        return []

    params = {
        "q": query,
        "apiKey": config.NEWS_API_KEY,
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": min(limit, 100),
    }
    if domains:
        params["domains"] = domains
    cache_key = ("newsapi", tuple(sorted(params.items())))
    payload = cache.read(cache_key, NEWS_CACHE_TTL_SECONDS)

    if payload is None:
        try:
            resp = requests.get(f"{config.NEWS_API_BASE_URL}/everything", params=params, timeout=20)
            resp.raise_for_status()
            payload = resp.json()
        except requests.exceptions.RequestException:
            return []  # network hiccup or NewsAPI-side error — don't crash the pipeline

        if payload.get("status") == "ok":
            cache.write(cache_key, payload)
        else:
            payload = {}  # error response — don't cache the failure

    events = []
    for item in payload.get("articles", []):
        if not item.get("url") or not item.get("publishedAt"):
            continue
        events.append(
            NewsEvent(
                id=_make_id(item["url"]),
                title=item.get("title") or "",
                summary=item.get("description") or "",
                source=(item.get("source") or {}).get("name", "newsapi"),
                url=item["url"],
                published_at=datetime.strptime(item["publishedAt"], "%Y-%m-%dT%H:%M:%SZ"),
                raw_sentiment=None,
                topics=[],
                tagged_tickers={},
            )
        )
    return events


def fetch_latest_news(limit: int = 50) -> list[NewsEvent]:
    """Merged, deduplicated feed. Alpha Vantage entries win on URL collisions
    since they carry sentiment + ticker tags."""
    av_events = fetch_alpha_vantage_news(limit=limit)
    newsapi_events = fetch_newsapi_news(limit=limit)

    merged: dict[str, NewsEvent] = {e.id: e for e in newsapi_events}
    merged.update({e.id: e for e in av_events})

    return sorted(merged.values(), key=lambda e: e.published_at, reverse=True)
