import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

ALPHA_VANTAGE_API_KEY = os.getenv("ALPHA_VANTAGE_API_KEY", "demo")
NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")
POLYGON_API_KEY = os.getenv("POLYGON_API_KEY", "")

ALPHA_VANTAGE_BASE_URL = "https://www.alphavantage.co/query"
NEWS_API_BASE_URL = "https://newsapi.org/v2"
POLYGON_BASE_URL = "https://api.polygon.io"

DATA_DIR = Path(__file__).parent / "data"
ASSET_UNIVERSE_CSV = DATA_DIR / "asset_universe.csv"
