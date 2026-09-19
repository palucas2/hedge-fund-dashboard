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
# WERE swept (tournament/sizing_sweep.py, SPY/TLT/AAPL, 5y, 20 combos each): the
# original 2.0/3.0 default averaged Sharpe ~0.03 across the three assets, near the
# bottom of the grid on every one of them. 1.0/6.0 (tight stop, wide target — cut
# losers fast, let winners run) averaged ~0.29 and was the only combo positive on
# all three assets individually — most other combos that looked great on one asset
# (e.g. AAPL's own best, 1.0/2.0) fell apart on another (TLT: -0.27). Still only 3
# assets, one 5y window — reasonable evidence, not proof; recheck with sized_backtest
# split-window before trusting this at real size.
TARGET_ANNUAL_VOL = float(os.getenv("TARGET_ANNUAL_VOL", "0.15"))
MAX_POSITION_PCT = float(os.getenv("MAX_POSITION_PCT", "0.10"))  # cap per single idea
STOP_LOSS_VOL_MULTIPLIER = float(os.getenv("STOP_LOSS_VOL_MULTIPLIER", "1.0"))
TAKE_PROFIT_VOL_MULTIPLIER = float(os.getenv("TAKE_PROFIT_VOL_MULTIPLIER", "6.0"))
CONVICTION_TAKE_THRESHOLD = int(os.getenv("CONVICTION_TAKE_THRESHOLD", "60"))
CONVICTION_WATCH_THRESHOLD = int(os.getenv("CONVICTION_WATCH_THRESHOLD", "35"))
