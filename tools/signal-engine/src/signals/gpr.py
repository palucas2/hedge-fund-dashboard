"""Geopolitical Risk proxy. The reference series is Caldara & Iacoviello's GPR
Index (matteoiacoviello.com/gpr.htm), built by counting geopolitical-risk
articles across newspapers. We approximate the same idea from our own live news
feed: the share of recently ingested articles that hit shock/conflict keywords,
scaled 0-100. This is a real computation over real (if narrower) data, not a
simulation — swap in the official CSV export for a truer index if needed."""

from src.models.schemas import NewsEvent, SignalResult

GEO_KEYWORDS = {
    "war", "invasion", "sanction", "embargo", "blockade", "ceasefire", "missile",
    "strike", "attack", "nuclear", "coup", "conflict", "military", "troops",
}


def compute(recent_events: list[NewsEvent]) -> SignalResult:
    if not recent_events:
        return SignalResult(
            name="gpr", asset="MACRO", value={}, direction="neutral", confidence=0.0,
            is_mocked=True, note="no recent news available to compute proxy",
        )

    hits = 0
    for event in recent_events:
        text = f"{event.title} {event.summary}".lower()
        if any(kw in text for kw in GEO_KEYWORDS):
            hits += 1

    share = hits / len(recent_events)
    score = round(min(share * 250, 100))  # calibrated so ~40% hit-rate -> 100

    direction = "bearish" if score >= 50 else "neutral"
    confidence = min(score / 100, 1.0)

    return SignalResult(
        name="gpr",
        asset="MACRO",
        value={"gpr_proxy_score": score, "geo_article_share": round(share, 3), "sample_size": len(recent_events)},
        direction=direction,
        confidence=round(confidence, 3),
        is_mocked=True,
        note="proxy built from live news feed keyword share, methodology inspired by Caldara-Iacoviello GPR — not the official index",
    )
