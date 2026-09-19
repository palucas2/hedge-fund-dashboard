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

# Trade construction — tournament-validated defaults (tools/signal-engine/tournament/):
# vol-targeted sizing halved max drawdown and lifted Sharpe in the portfolio backtest;
# these thresholds are a starting point, not tuned/optimized against any backtest yet.
TARGET_ANNUAL_VOL = float(os.getenv("TARGET_ANNUAL_VOL", "0.15"))
MAX_POSITION_PCT = float(os.getenv("MAX_POSITION_PCT", "0.10"))  # cap per single idea
STOP_LOSS_VOL_MULTIPLIER = float(os.getenv("STOP_LOSS_VOL_MULTIPLIER", "2.0"))
TAKE_PROFIT_VOL_MULTIPLIER = float(os.getenv("TAKE_PROFIT_VOL_MULTIPLIER", "3.0"))  # ~1.5:1 reward:risk
CONVICTION_TAKE_THRESHOLD = int(os.getenv("CONVICTION_TAKE_THRESHOLD", "60"))
CONVICTION_WATCH_THRESHOLD = int(os.getenv("CONVICTION_WATCH_THRESHOLD", "35"))
