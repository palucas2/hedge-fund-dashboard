# Signal Engine

News-to-trade-idea pipeline for the Hedge Fund Dashboard project (see `../../README.md` at the project root; spec doc kept outside this repo). Standalone Python service, designed to be called from the Next.js backend later (Module 5 Regime Detector, Module 6 Market Recap, Module 9 Volatility & Event Tracker).

```
news in -> impact score (0-100) -> affected assets -> quant signal bank -> ranked trade ideas
```

## Pipeline

1. **Ingestion** — Alpha Vantage `NEWS_SENTIMENT` (primary; ships ticker tags + sentiment) merged with NewsAPI.org (broader coverage, no built-in tagging).
2. **Impact scoring** — 0-100 score from sentiment magnitude, ticker breadth, macro-topic weight, and shock-keyword hits.
3. **Entity resolution** — direct AV ticker tags, plus keyword matching against `data/asset_universe.csv` (stocks, ETFs, commodities, bonds, FX, crypto) to catch what AV doesn't tag.
4. **Signal bank** — one module per asset, in `src/signals/`:

   | Signal | Data source | Status |
   |---|---|---|
   | HMM regime | Alpha Vantage daily prices | real |
   | Kalman filter | Alpha Vantage daily prices | real |
   | VWAP | Polygon intraday bars | real (needs Polygon tier); proxy fallback otherwise |
   | OFI | Polygon NBBO quotes | real (needs Polygon tier); proxy fallback otherwise |
   | Bai-Perron breaks | Alpha Vantage daily prices (PELT approximation) | real |
   | Dark pool prints | Polygon trades (TRF tag) | real (needs Polygon tier); proxy fallback otherwise |
   | GEX (aggregate) | Polygon options snapshot | real (needs Polygon options add-on); proxy fallback otherwise |
   | Vol surface skew | Polygon options snapshot | real (needs Polygon options add-on); no fallback (returns neutral) |
   | VRP | Alpha Vantage prices + Polygon options | realized vol always real; implied vol proxied without options data |
   | VIX term structure | Polygon indices | real (needs Polygon indices add-on); realized-vol proxy fallback |
   | GPR | own news feed keyword density | proxy for the Caldara-Iacoviello index |

   Every `SignalResult` carries `is_mocked` — the synthesizer down-weights proxy signals instead of hiding them.

5. **Idea synthesis** — confidence-weighted vote across signals -> `long` / `short` / `neutral` with a 0-100 conviction score and a plain-text thesis.

## Setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your keys
python examples/run_pipeline.py --news-limit 15 --top 10
```

Run tests (no network calls, safe to run anytime):

```bash
pip install -r requirements-dev.txt
pytest tests/
```

Keys needed in `.env` (never commit this file — it's gitignored):
- `ALPHA_VANTAGE_API_KEY` — free at https://www.alphavantage.co/support/#api-key. Free tier: **25 req/day total**, 5 req/min. This is the binding constraint — a handful of pipeline runs will exhaust it.
- `NEWS_API_KEY` — https://newsapi.org. Free tier: 100 req/day, dev use only.
- `POLYGON_API_KEY` — https://polygon.io. Free tier: 5 req/min, EOD data, no options/indices add-ons (those signals fall back to proxies until you upgrade).

Two things keep the free tiers usable:
- **Disk cache** (`src/ingestion/cache.py`, `.cache/` dir, gitignored) — Alpha Vantage responses are cached 12h (EOD data doesn't change intraday), news 10min, Polygon 5min. Only successful responses are cached; rate-limit/error replies are never persisted as if they were real data.
- **`--fast` flag** — skips every Polygon call so VWAP/OFI/dark pool/GEX/vol skew go straight to their proxy path. A 10-news-item run drops from several minutes (Polygon's 5 req/min throttle) to ~10s. Good for iterating on scoring/mapping/HMM/Kalman/Bai-Perron logic without waiting.

```bash
python examples/run_pipeline.py --news-limit 15 --top 10 --fast
```

Without `--fast`, the client throttles Polygon calls to stay under the free-tier rate limit, so a run with several assets will take a while — that's expected, not a hang.

If Alpha Vantage's daily quota is already spent, `NEWS_SENTIMENT` and price lookups return empty (not an error) — the pipeline still runs, but since NewsAPI events carry no sentiment/ticker tags, they can't clear the impact-score threshold alone (their score maxes out around 20/100 on keywords only, vs. the 25 threshold). Ideas resume once AV's quota resets, or once you're on a paid AV tier.

## Strategy tournament (`tournament/`)

Backtests every bot against every asset and ranks them — turns the signal bank into daily long/flat/short position series and runs them through [vectorbt](https://github.com/polakowo/vectorbt) (Apache 2.0 + Commons Clause — free for internal use, just can't resell the library itself). Historical data comes from Yahoo Finance (`yfinance`), not Alpha Vantage — pulling years of daily history across several assets would blow through AV's 25 req/day free cap in one run.

```bash
pip install -r requirements-tournament.txt
python examples/run_tournament.py                                    # SPY, AAPL, GLD, TLT, BTC-USD, 5y
python examples/run_tournament.py --symbols SPY QQQ --period 10y
```

Bots (`tournament/bots.py`):

| Bot | Logic |
|---|---|
| `buy_and_hold` | baseline — always long |
| `hmm_regime` | HMM regime call, refit every 21 trading days on an expanding window |
| `bai_perron` | post-breakpoint slope direction, same refit cadence |
| `kalman_trend` | sign of the Kalman filter's trend term — causal by construction, computed once over the full series |
| `full_stack` | majority vote of the three above, same refit cadence |

Positions are shifted one bar forward before backtesting (a signal from day t's close can't be traded until day t+1 — no lookahead). HMM/Bai-Perron refit periodically rather than daily; refitting either model on every single day over 5 years per asset per bot isn't worth the compute for what's the same regime call on all but a handful of days.

Real run, 5 assets x 5 bots, 5-year daily history (Sep 2026): buy-and-hold won on Sharpe on SPY/AAPL/GLD/BTC — all four were in a strong multi-year uptrend, where regime/trend bots mostly add whipsaw. The interesting result is TLT (bonds, in a multi-year *downtrend* over the same window): buy-and-hold scored -0.58 Sharpe, and every active bot beat it (best: `bai_perron` at +0.08) — the one asset where regime detection had an actual regime to detect. Small sample (one non-overlapping 5y window per asset), reran to check robustness before trusting the numbers for sizing.

## Known limitations

- **GEX, vol skew, VIX term structure, dark pool, OFI, VWAP** need Polygon data tiers (options add-on, indices add-on, quotes) not included in the free plan. They degrade to clearly-labeled proxies (`is_mocked=True`) rather than fail — swap in a real vendor (ORATS, CBOE DataShop, FINRA ADF, Databento) by extending `market_data_client.py` and each signal module keeps working unchanged.
- **GPR** uses a news-density proxy, not the official Caldara-Iacoviello series.
- **Asset universe** (`data/asset_universe.csv`) is a ~120-symbol seed list, not an exhaustive database — extend it as needed.

## Structure

```
signal-engine/
├── config.py                    # env vars, API base URLs
├── src/
│   ├── models/schemas.py        # NewsEvent, ImpactScore, AssetHit, SignalResult, TradeIdea
│   ├── ingestion/                # news_client.py, market_data_client.py
│   ├── scoring/impact_scorer.py
│   ├── entity_resolution/        # asset_universe.py, asset_mapper.py
│   ├── signals/                  # one module per quant signal
│   ├── idea_generator/synthesizer.py
│   └── pipeline.py               # orchestrates the full flow
├── data/asset_universe.csv
├── tournament/                    # backtest tournament (bots.py, engine.py, data_loader.py)
├── examples/
│   ├── run_pipeline.py            # CLI entry point
│   └── run_tournament.py
└── tests/test_smoke.py
```
