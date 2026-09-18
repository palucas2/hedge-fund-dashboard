from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class AssetClass(str, Enum):
    STOCK = "stock"
    ETF = "etf"
    COMMODITY = "commodity"
    BOND = "bond"
    FX = "fx"
    CRYPTO = "crypto"


@dataclass
class NewsEvent:
    id: str
    title: str
    summary: str
    source: str
    url: str
    published_at: datetime
    raw_sentiment: float | None = None  # Alpha Vantage overall_sentiment_score, -1..1
    topics: list[str] = field(default_factory=list)
    tagged_tickers: dict[str, float] = field(default_factory=dict)  # ticker -> AV relevance_score


@dataclass
class ImpactScore:
    news_id: str
    score: int  # 0-100
    direction: str  # "bullish" | "bearish" | "neutral"
    rationale: list[str] = field(default_factory=list)


@dataclass
class AssetHit:
    symbol: str
    name: str
    asset_class: AssetClass
    relevance: float  # 0-1, how confidently this asset is tied to the news


@dataclass
class SignalResult:
    name: str
    asset: str
    value: dict  # signal-specific payload
    direction: str  # "bullish" | "bearish" | "neutral"
    confidence: float  # 0-1
    is_mocked: bool = False  # True if computed from a proxy/simulation, not live data
    note: str = ""


@dataclass
class TradeIdea:
    asset: str
    asset_class: AssetClass
    direction: str  # "long" | "short" | "neutral"
    conviction: int  # 0-100
    thesis: str
    supporting_signals: list[SignalResult] = field(default_factory=list)
    news_trigger: NewsEvent | None = None
    impact_score: ImpactScore | None = None
