import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.entity_resolution.asset_mapper import map_news_to_assets
from src.idea_generator.synthesizer import synthesize
from src.models.schemas import NewsEvent
from src.scoring.impact_scorer import score_news
from src.signals import bai_perron, dark_pool, gex, hmm_regime, kalman_filter, ofi, vol_skew, vrp, vwap

import pandas as pd


def make_event(**overrides) -> NewsEvent:
    defaults = dict(
        id="t1",
        title="Fed signals emergency rate cut amid banking crisis fears, IBM shares fall",
        summary="Recession and default fears spread after a surprise policy shift.",
        source="test",
        url="http://test/1",
        published_at=datetime.now(),
        raw_sentiment=-0.5,
        topics=["economy_monetary", "financial_markets"],
        tagged_tickers={"IBM": 0.9},
    )
    defaults.update(overrides)
    return NewsEvent(**defaults)


def test_impact_scorer_flags_high_impact_news():
    event = make_event()
    impact = score_news(event)
    assert impact.score >= 50
    assert impact.direction == "bearish"


def test_impact_scorer_low_signal_news():
    event = make_event(raw_sentiment=0.01, topics=[], tagged_tickers={}, title="Local bakery wins award", summary="")
    impact = score_news(event)
    assert impact.score < 25


def test_asset_mapper_direct_ticker_hit():
    event = make_event()
    hits = map_news_to_assets(event)
    symbols = [h.symbol for h in hits]
    assert "IBM" in symbols


def test_asset_mapper_keyword_hit():
    event = make_event(
        title="Rate cut expectations shift as bond yields react",
        summary="Treasury markets moved after the announcement.",
        tagged_tickers={},
    )
    hits = map_news_to_assets(event)
    assert any(h.symbol in ("TLT", "IEF", "SHY", "US10Y", "US2Y") for h in hits)


def test_signals_degrade_gracefully_on_empty_data():
    empty = pd.DataFrame()
    for module in (hmm_regime, kalman_filter, bai_perron):
        result = module.compute("TEST", empty)
        assert result.direction == "neutral"
        assert result.is_mocked is True

    assert vwap.compute("TEST").is_mocked is True
    assert ofi.compute("TEST").is_mocked is True
    assert dark_pool.compute("TEST").is_mocked is True
    assert gex.compute("TEST", options_df=None, spot_price=None).is_mocked is True
    assert vol_skew.compute("TEST", options_df=None).is_mocked is True
    assert vrp.compute("TEST", empty).is_mocked is True


def test_synthesizer_produces_directional_idea_from_bearish_signals():
    event = make_event()
    impact = score_news(event)
    signals = [
        hmm_regime.compute("IBM", pd.DataFrame()),  # neutral, mocked
        vwap.compute("IBM"),  # neutral, mocked (no data passed)
    ]
    # force a clearly bearish, non-mocked signal into the mix
    from src.models.schemas import SignalResult

    signals.append(
        SignalResult(name="test_signal", asset="IBM", value={}, direction="bearish", confidence=0.9, is_mocked=False)
    )

    idea = synthesize("IBM", event, impact, signals)
    assert idea.direction in ("short", "neutral")
    assert 0 <= idea.conviction <= 100


if __name__ == "__main__":
    import pytest

    raise SystemExit(pytest.main([__file__, "-v"]))
