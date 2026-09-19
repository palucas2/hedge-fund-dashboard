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
6. **Trade construction** (`src/idea_generator/trade_builder.py`) — turns the idea into a `TradeSpec`: conviction gate (`take` / `watch` / `skip`), vol-targeted position size, and vol-based stop-loss/take-profit. See "Trade construction" below.

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

## Trade construction (`src/idea_generator/trade_builder.py`)

A `TradeIdea` (direction + conviction) isn't a trade — this turns it into a `TradeSpec` with an actual size and risk levels:

- **Conviction gate**: `>= CONVICTION_TAKE_THRESHOLD` (default 60) -> `take`; `>= CONVICTION_WATCH_THRESHOLD` (default 35) -> `watch`, logged but not sized; below that, or no directional call -> `skip`, not logged at all.
- **Sizing**: `MAX_POSITION_PCT` (default 10% of capital) scaled down by `TARGET_ANNUAL_VOL / realized_annual_vol`, never scaled up past the cap. This specific mechanism — not the exact numbers — is the one finding from the tournament (`tournament/portfolio_bots.py`) solid enough to build on: it roughly halved max drawdown and lifted Sharpe in a real multi-asset backtest.
- **Stop-loss/take-profit**: a multiple of recent daily realized vol (`STOP_LOSS_VOL_MULTIPLIER`=2.0, `TAKE_PROFIT_VOL_MULTIPLIER`=3.0, ~1.5:1 reward:risk), not a fixed percentage — a 5% stop means something very different on TLT than on BTC-USD.

All five constants are env-overridable (see `config.py`) and are documented starting defaults, not backtested/tuned outputs — nothing here has been validated the way the tournament's bots were.

**Validated, partially** — `tournament/sized_backtest.py` backtests the *actual* production formula (imports `src/idea_generator/sizing.py` directly, not a reimplementation) on top of `full_stack`'s signal, with real OHLC-based stop/target triggering instead of just signal-based rebalancing:

```bash
python examples/run_sized_backtest.py                    # SPY, AAPL, GLD, TLT, BTC-USD, 5y
```

Real run, SPY/TLT, 5y: max drawdown drops sharply with real sizing/stops (SPY 28%→2%, TLT 37%→3%) — expected, since `MAX_POSITION_PCT` caps exposure at 10% of capital vs. the raw bots' fully-invested 100%. That's not really an apples-to-apples return comparison (10% exposure obviously returns less than 100% exposure) so much as a demonstration that the capital-preservation discipline works as designed — this is what one position looks like sized as a slice of a diversified book, not a full-capital bet on one asset. One thing worth a closer look: stop/target exits still fire often (~160 trades over 5y) — `STOP_LOSS_VOL_MULTIPLIER=2.0` may be tight relative to normal daily noise; hasn't been swept the way `tournament/param_sweep.py` swept SMA/RSI.

### Writing ideas into the dashboard (`src/output/alerts_writer.py`)

```bash
python examples/run_pipeline.py --news-limit 15 --write-alerts
```

Writes every `take`/`watch` spec as a row in the same Postgres `alerts` table the Next.js dashboard's Module 9 (Volatility & Event Tracker) reads from — `type='signal_engine'`, severity `red`/`orange` (take, by conviction) or `yellow` (watch), `relevance_score` 1-5 from conviction. Deduped by (asset, title) within a rolling 24h window so re-running the pipeline doesn't spam duplicate alerts. `skip` specs are never written.

Needs `DATABASE_URL` in `.env` (same Neon connection string as the Next.js app's own `.env`). Uses plain `psycopg2`, not Prisma — worth noting because in this project's dev sandbox, Prisma's CLI (`db pull`/`migrate`) can't reach Postgres at all (its Rust engine's connection handling trips on something the sandbox's network layer doesn't like) while `psycopg2` connects immediately; that's an artifact of Prisma's engine in that specific environment, not a real restriction, so this writer works the same way here as it will in production.

### Running continuously (`examples/run_daemon.py`)

```bash
python examples/run_daemon.py --interval 900          # every 15 min, forever
python examples/run_daemon.py --interval 5 --cycles 2 --fast   # quick local test
```

Polls the pipeline on an interval and writes alerts each cycle — no dedicated cron infra, same pattern the dashboard's own Module 9 polling already uses. One bad cycle (API hiccup, transient DB error) is caught and logged, never kills the loop. This is the thing you'd actually run on a server/cron for it to do anything unattended — nothing here runs itself without a process staying up.

## Strategy tournament (`tournament/`)

Backtests every bot against every asset and ranks them — turns the signal bank into daily long/flat/short position series and runs them through [vectorbt](https://github.com/polakowo/vectorbt) (Apache 2.0 + Commons Clause — free for internal use, just can't resell the library itself). Historical data comes from Yahoo Finance (`yfinance`), not Alpha Vantage — pulling years of daily history across several assets would blow through AV's 25 req/day free cap in one run.

```bash
pip install -r requirements-tournament.txt
python examples/run_tournament.py                                    # 16 assets x 8 bots x 2 windows, 10y
python examples/run_tournament.py --symbols SPY QQQ --period 10y --windows 3
```

Bots (`tournament/bots.py`):

| Bot | Logic |
|---|---|
| `buy_and_hold` | baseline — always long |
| `hmm_regime` | HMM regime call, refit every 21 trading days on an expanding window |
| `bai_perron` | post-breakpoint slope direction, same refit cadence |
| `kalman_trend` | sign of the Kalman filter's trend term — causal by construction, computed once over the full series |
| `full_stack` | majority vote of the three above, same refit cadence |
| `hmm_kalman_confirm` | only trades when HMM and Kalman agree; flat otherwise — higher conviction, fewer trades |
| `sma_crossover` | classic 50/200-day moving-average crossover, independent of the signal bank — the benchmark every other bot has to beat, not just buy-and-hold |
| `rsi_mean_reversion` | contrarian — long oversold (RSI<30), short overbought (RSI>70); the only non-trend-following bot in the roster |

Positions are shifted one bar forward before backtesting (a signal from day t's close can't be traded until day t+1 — no lookahead), and every trade pays a 5bps fee (`DEFAULT_FEES` in `engine.py`) — without it, the high-turnover bots (300-600 trades over 5y) show backtested Sharpe no real broker/spread would let you keep. HMM/Bai-Perron refit periodically rather than daily; refitting either model on every single day over years of history per asset per bot isn't worth the compute for what's the same regime call on all but a handful of days.

**Split-window evaluation, not one lucky run.** A single backtest window is a sample size of one — `run_tournament(..., n_windows=2)` splits the full history into non-overlapping chunks (default: `10y` -> two 5y windows) and backtests every bot on every window independently. The leaderboard's `consistency_pct` column (share of asset/window combos with positive Sharpe) is what actually separates a robust bot from one carried by a single good window on a single asset — a bot with a great average Sharpe but 25% consistency got lucky once, not built an edge.

Real run, 16 assets x 8 bots x 2 non-overlapping 5y windows, fees included (Sep 2026): **buy-and-hold wins overall** — avg Sharpe 0.77, 84% consistency, ahead of every active bot. Best of the rest: `sma_crossover` (0.36 Sharpe, 72% consistency) and `bai_perron` (0.25, 72%). `rsi_mean_reversion` and `hmm_regime` finished with negative average Sharpe. This is the honest, unflattering, and expected result — most systematic signals don't beat a passive benchmark net of costs, which is the standard finding in the actual quant literature, not a reason to keep tuning until the number looks better. Treat this as a starting point for further validation (out-of-sample paper trading, more windows), not as a signal to size real capital off backtested Sharpe alone.

### Follow-up experiments

Three more angles, each independently tested and each an honest result rather than a search for a number that looks good:

- **`tournament/param_sweep.py`** — is a bot's chosen parameter set (SMA 50/200, RSI 14/30/70) actually robust, or just the one combo that happened to backtest well? Swept 24 SMA and 36 RSI combos across SPY/AAPL/TLT: SMA crossover held up (96% of nearby combos had positive Sharpe — the default isn't optimal but it's solidly mid-pack), **RSI mean-reversion did not** (only 36% positive, and on TLT the exact chosen default ranked dead last of 12 neighbors tested) — confirms `rsi_mean_reversion`'s tournament result was noise, not signal. Run: `python examples/run_param_sweep.py`.
- **`tournament/portfolio_bots.py`** — vol-targeted position sizing (scale each bot's call by target-vol/realized-vol, so it sizes down in chop and up when calm) combined into an equal-weight multi-asset portfolio. On SPY/TLT/GLD/BTC-USD/AAPL over 3y, vol-targeting roughly halved max drawdown and meaningfully lifted Sharpe for both `full_stack` and `sma_crossover` — a real risk-adjusted improvement, though buy-and-hold still won on raw return in this bull-market window. Run: `python examples/run_portfolio_backtest.py`.
- **`tournament/vol_regime_bot.py`** — forcing a bot flat during high-realized-vol stretches (75th percentile threshold), tested against plain `full_stack` on SPY/AAPL/TLT/BTC-USD. **Hurt in 3 of 4 cases** — high-vol periods often contain the real trending moves a regime bot is trying to catch, not just chop, so filtering them out cut both return and (on BTC-USD) actually raised max drawdown by cutting a recovery short. Only helped on TLT, the most range-bound of the four. Not a clean win; don't treat it as validated. Run: `python examples/run_vol_regime_test.py`.

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
