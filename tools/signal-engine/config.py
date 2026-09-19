import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

ALPHA_VANTAGE_API_KEY = os.getenv("ALPHA_VANTAGE_API_KEY", "demo")
NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")
POLYGON_API_KEY = os.getenv("POLYGON_API_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")

ALPHA_VANTAGE_BASE_URL = "https://www.alphavantage.co/query"
NEWS_API_BASE_URL = "https://newsapi.org/v2"
POLYGON_BASE_URL = "https://api.polygon.io"

DATA_DIR = Path(__file__).parent / "data"
ASSET_UNIVERSE_CSV = DATA_DIR / "asset_universe.csv"

# Trade construction. TARGET_ANNUAL_VOL/MAX_POSITION_PCT are tournament-informed
# (tournament/portfolio_bots.py: vol-targeted sizing halved max drawdown, lifted
# Sharpe) but not swept themselves. STOP_LOSS_VOL_MULTIPLIER/TAKE_PROFIT_VOL_MULTIPLIER
# WERE swept — first pass (SPY/TLT/AAPL, 5y, 1 window, 20 combos) picked 1.0/6.0;
# a wider rerun (tournament/sizing_sweep.sweep_stops_multi_asset_window: SPY/AAPL/
# TLT/GLD/QQQ/BTC-USD, 10y split into 2 non-overlapping 5y windows, 240 total
# (symbol, window, combo) results) confirmed the same pick — 1.0/6.0 topped the
# leaderboard on avg Sharpe (0.62) with 91.7% of combos positive, vs. the original
# 2.0/3.0 default landing mid-pack (rank 15/20, Sharpe 0.41). Cut losers fast (tight
# stop), let winners run (wide target) held up going from 60 to 240 samples — real
# evidence now, not just 3 single-window data points, though still only 6 assets.
TARGET_ANNUAL_VOL = float(os.getenv("TARGET_ANNUAL_VOL", "0.15"))
MAX_POSITION_PCT = float(os.getenv("MAX_POSITION_PCT", "0.10"))  # cap per single idea
STOP_LOSS_VOL_MULTIPLIER = float(os.getenv("STOP_LOSS_VOL_MULTIPLIER", "1.0"))
TAKE_PROFIT_VOL_MULTIPLIER = float(os.getenv("TAKE_PROFIT_VOL_MULTIPLIER", "6.0"))
CONVICTION_TAKE_THRESHOLD = int(os.getenv("CONVICTION_TAKE_THRESHOLD", "60"))
CONVICTION_WATCH_THRESHOLD = int(os.getenv("CONVICTION_WATCH_THRESHOLD", "35"))
