"""Combines a news event's impact score with the bank of quant signals computed
for one asset into a single TradeIdea. Each signal votes bullish(+1)/bearish(-1)/
neutral(0) weighted by its own confidence; mocked/proxy signals are down-weighted
since they're a stand-in for data we don't have yet, not a live measurement."""

from src.entity_resolution.asset_universe import lookup_symbol
from src.models.schemas import AssetClass, ImpactScore, NewsEvent, SignalResult, TradeIdea

MOCKED_SIGNAL_WEIGHT = 0.5
DIRECTION_SCORE = {"bullish": 1, "bearish": -1, "neutral": 0}
LONG_THRESHOLD = 0.15
SHORT_THRESHOLD = -0.15


def _weighted_vote(signals: list[SignalResult]) -> tuple[float, float]:
    """Returns (net_directional_score in [-1,1], total_weight used)."""
    total_weight = 0.0
    weighted_sum = 0.0
    for s in signals:
        weight = s.confidence * (MOCKED_SIGNAL_WEIGHT if s.is_mocked else 1.0)
        weighted_sum += DIRECTION_SCORE[s.direction] * weight
        total_weight += weight

    if total_weight == 0:
        return 0.0, 0.0
    return weighted_sum / total_weight, total_weight


def _build_thesis(
    asset: str, direction: str, news: NewsEvent, impact: ImpactScore, signals: list[SignalResult]
) -> str:
    lines = [f"News: \"{news.title}\" (impact {impact.score}/100, {impact.direction})."]
    for s in signals:
        tag = " [proxy]" if s.is_mocked else ""
        lines.append(f"  - {s.name}{tag}: {s.direction} (confidence {s.confidence:.2f}) — {s.note}")
    lines.append(f"Net read on {asset}: {direction.upper()}.")
    return "\n".join(lines)


def synthesize(
    asset: str, news: NewsEvent, impact: ImpactScore, signals: list[SignalResult]
) -> TradeIdea:
    net_score, total_weight = _weighted_vote(signals)

    if total_weight == 0:
        direction = "neutral"
    elif net_score >= LONG_THRESHOLD:
        direction = "long"
    elif net_score <= SHORT_THRESHOLD:
        direction = "short"
    else:
        direction = "neutral"

    # conviction blends: how strongly signals agree (|net_score|), how much
    # weight backed that agreement, and how impactful the triggering news is
    agreement_component = abs(net_score) * 60
    weight_component = min(total_weight / max(len(signals), 1), 1.0) * 20
    news_component = impact.score / 100 * 20
    conviction = round(min(agreement_component + weight_component + news_component, 100))

    universe_entry = lookup_symbol(asset)
    asset_class = universe_entry["asset_class"] if universe_entry else AssetClass.STOCK

    return TradeIdea(
        asset=asset,
        asset_class=asset_class,
        direction=direction,
        conviction=conviction,
        thesis=_build_thesis(asset, direction, news, impact, signals),
        supporting_signals=signals,
        news_trigger=news,
        impact_score=impact,
    )
