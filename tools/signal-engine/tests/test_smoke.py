import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import config
from src.entity_resolution.asset_mapper import map_news_to_assets
from src.idea_generator.synthesizer import synthesize
from src.idea_generator.trade_builder import build_trade_spec
from src.models.schemas import AssetClass, NewsEvent, TradeIdea
from src.scoring.impact_scorer import score_news
from src.signals import bai_perron, dark_pool, gex, hmm_regime, kalman_filter, ofi, vol_skew, vrp, vwap

import numpy as np
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


def test_vwap_handles_zero_volume_without_crashing():
    """Regression: bonds/FX/commodities carry volume=0 (pipeline.py's flat-series
    conversion) — vwap.py used to divide by a zero volume sum and hand back NaN,
    which crashed the synthesizer's round(conviction) downstream."""
    zero_volume_df = _synthetic_price_df(n=30)
    zero_volume_df["volume"] = 0.0

    result = vwap.compute("TEST", daily_df=zero_volume_df)
    assert result.direction == "neutral"
    assert result.is_mocked is True
    assert not pd.isna(result.confidence)


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


def _synthetic_price_df(n=100, seed=0):
    rng = np.random.default_rng(seed)
    prices = 100 + np.cumsum(rng.standard_normal(n) * 0.5)
    return pd.DataFrame(
        {"close": prices, "open": prices, "high": prices * 1.01, "low": prices * 0.99, "volume": 1e6},
        index=pd.date_range("2025-01-01", periods=n),
    )


def _make_idea(conviction, direction="long"):
    return TradeIdea(asset="TEST", asset_class=AssetClass.STOCK, direction=direction, conviction=conviction, thesis="t")


def test_trade_builder_skips_low_conviction():
    spec = build_trade_spec(_make_idea(config.CONVICTION_WATCH_THRESHOLD - 1), _synthetic_price_df())
    assert spec.action == "skip"
    assert spec.size_pct == 0.0
    assert spec.stop_loss is None


def test_trade_builder_watches_mid_conviction():
    mid = (config.CONVICTION_WATCH_THRESHOLD + config.CONVICTION_TAKE_THRESHOLD) // 2
    spec = build_trade_spec(_make_idea(mid), _synthetic_price_df())
    assert spec.action == "watch"
    assert spec.size_pct == 0.0


def test_trade_builder_takes_high_conviction_with_sane_sizing():
    spec = build_trade_spec(_make_idea(config.CONVICTION_TAKE_THRESHOLD + 10, "long"), _synthetic_price_df())
    assert spec.action == "take"
    assert 0 < spec.size_pct <= config.MAX_POSITION_PCT
    assert spec.stop_loss < spec.entry_price < spec.take_profit  # long: stop below, target above


def test_trade_builder_short_stop_and_target_are_mirrored():
    spec = build_trade_spec(_make_idea(config.CONVICTION_TAKE_THRESHOLD + 10, "short"), _synthetic_price_df())
    assert spec.action == "take"
    assert spec.take_profit < spec.entry_price < spec.stop_loss  # short: stop above, target below


def test_trade_builder_skips_sizing_without_enough_history():
    short_df = _synthetic_price_df(n=5)
    spec = build_trade_spec(_make_idea(config.CONVICTION_TAKE_THRESHOLD + 10), short_df)
    assert spec.action != "take"
    assert spec.size_pct == 0.0


if __name__ == "__main__":
    import pytest

    raise SystemExit(pytest.main([__file__, "-v"]))
