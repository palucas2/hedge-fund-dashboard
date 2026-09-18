"""End-to-end orchestration: news in, ranked trade ideas out.

    fetch news -> score impact -> map to assets -> run signal bank per asset -> synthesize idea

Price history is normalized to a common OHLCV-shaped DataFrame regardless of
asset class (stocks/ETFs use real OHLCV from Alpha Vantage; commodities/bonds/FX
only publish a single daily value, so open/high/low/close are all set to that
value and volume is left at 0 — volume-dependent signals then just abstain).
"""

from datetime import date, timedelta

import pandas as pd

from src.entity_resolution.asset_mapper import map_news_to_assets
from src.idea_generator.synthesizer import synthesize
from src.ingestion import market_data_client, news_client
from src.models.schemas import AssetClass, AssetHit, NewsEvent, TradeIdea
from src.scoring.impact_scorer import score_news
from src.signals import bai_perron, dark_pool, gex, hmm_regime, kalman_filter, ofi, vix_term_structure, vol_skew, vrp, vwap

MIN_IMPACT_SCORE = 25
MAX_ASSETS_PER_NEWS = 5

_price_cache: dict[str, pd.DataFrame] = {}


def _flat_series_to_ohlcv(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    out = pd.DataFrame(index=df.index)
    out["open"] = out["high"] = out["low"] = out["close"] = df["value"]
    out["volume"] = 0.0
    return out


def get_price_history(asset: AssetHit) -> pd.DataFrame:
    if asset.symbol in _price_cache:
        return _price_cache[asset.symbol]

    try:
        if asset.asset_class == AssetClass.COMMODITY:
            df = _flat_series_to_ohlcv(market_data_client.get_commodity_series(asset.symbol.lower(), interval="daily"))
        elif asset.asset_class == AssetClass.BOND:
            maturity = asset.symbol.replace("US", "").lower()
            df = _flat_series_to_ohlcv(market_data_client.get_treasury_yield(maturity=maturity, interval="daily"))
        elif asset.asset_class == AssetClass.FX:
            base, quote = asset.symbol[:3], asset.symbol[3:]
            df = market_data_client.get_fx_daily(base, quote)
            if not df.empty:
                df["volume"] = 0.0
        elif asset.asset_class == AssetClass.CRYPTO:
            df = market_data_client.get_crypto_daily(asset.symbol)
            if not df.empty:
                df = df.rename(columns={c: c for c in df.columns})
                for col in ("open", "high", "low", "close"):
                    if col not in df.columns:
                        df[col] = df.get("close", pd.Series(dtype=float))
                df["volume"] = df.get("volume", 0.0)
        else:
            df = market_data_client.get_daily_prices(asset.symbol)
    except Exception:
        df = pd.DataFrame()

    _price_cache[asset.symbol] = df
    return df


def run_signals_for_asset(asset: AssetHit, price_df: pd.DataFrame, use_polygon: bool = True) -> list:
    today = date.today()
    from_date = (today - timedelta(days=5)).isoformat()
    to_date = today.isoformat()

    if use_polygon:
        intraday_df = market_data_client.get_intraday_aggregates(asset.symbol, from_date, to_date)
        quotes_df = market_data_client.get_quotes(asset.symbol, to_date)
        trades_df = market_data_client.get_trades(asset.symbol, to_date)
        options_df = market_data_client.get_options_snapshot(asset.symbol)
    else:
        # --fast mode: skip every Polygon call, signals fall straight to their proxy path
        intraday_df = pd.DataFrame()
        quotes_df = pd.DataFrame()
        trades_df = pd.DataFrame()
        options_df = pd.DataFrame()
    spot_price = float(price_df["close"].iloc[-1]) if not price_df.empty else None

    signals = [
        hmm_regime.compute(asset.symbol, price_df),
        kalman_filter.compute(asset.symbol, price_df),
        vwap.compute(asset.symbol, intraday_df=intraday_df, daily_df=price_df),
        ofi.compute(asset.symbol, quotes_df=quotes_df, daily_df=price_df),
        bai_perron.compute(asset.symbol, price_df),
        dark_pool.compute(asset.symbol, trades_df=trades_df, daily_df=price_df),
        gex.compute(asset.symbol, options_df=options_df, spot_price=spot_price, price_df=price_df),
        vol_skew.compute(asset.symbol, options_df=options_df),
        vrp.compute(asset.symbol, price_df, options_df=options_df, spot_price=spot_price),
    ]
    return signals


def process_news_event(event: NewsEvent, use_polygon: bool = True) -> list[TradeIdea]:
    impact = score_news(event)
    if impact.score < MIN_IMPACT_SCORE:
        return []

    asset_hits = map_news_to_assets(event, max_assets=MAX_ASSETS_PER_NEWS)
    ideas = []
    for asset in asset_hits:
        price_df = get_price_history(asset)
        signals = run_signals_for_asset(asset, price_df, use_polygon=use_polygon)
        ideas.append(synthesize(asset.symbol, event, impact, signals))

    return ideas


def run_pipeline(news_limit: int = 20, use_polygon: bool = True) -> list[TradeIdea]:
    events = news_client.fetch_latest_news(limit=news_limit)

    all_ideas: list[TradeIdea] = []
    for event in events:
        all_ideas.extend(process_news_event(event, use_polygon=use_polygon))

    # macro overlay, independent of any single news item
    gpr_signal = None
    try:
        from src.signals import gpr

        gpr_signal = gpr.compute(events)
    except Exception:
        pass

    all_ideas.sort(key=lambda idea: idea.conviction, reverse=True)
    if gpr_signal:
        for idea in all_ideas:
            idea.supporting_signals.append(gpr_signal)

    return all_ideas
