"""Free options chain data via yfinance — strike/OI/IV, no key, no paid tier.
Used as a fallback when Polygon's options snapshot is empty (no options
add-on on the current plan), which lets GEX and vol_skew run for real instead
of falling back to their proxy path.

yfinance doesn't ship greeks (delta/gamma), only IV/OI/volume/strike — computed
here via Black-Scholes from (spot, strike, IV, time-to-expiry). RISK_FREE_RATE
is a constant approximation, not pulled from the live Treasury curve; good
enough for the delta/gamma this feeds (both are far more sensitive to IV and
moneyness than to a percent or two of rate), but worth swapping in
market_data_client.get_treasury_yield("3month") if this needs to be precise.
"""

from __future__ import annotations

from datetime import datetime

import numpy as np
import pandas as pd
import yfinance as yf
from scipy.stats import norm

RISK_FREE_RATE = 0.045
MAX_EXPIRATIONS = 4


def black_scholes_greeks(spot: float, strike: float, iv: float, time_to_expiry_years: float, option_type: str, r: float = RISK_FREE_RATE) -> tuple[float, float]:
    """Returns (delta, gamma). Degenerate inputs (expired, zero/invalid IV) return (0.0, 0.0)."""
    if time_to_expiry_years <= 0 or iv is None or iv <= 0 or spot <= 0 or strike <= 0:
        return 0.0, 0.0

    d1 = (np.log(spot / strike) + (r + iv**2 / 2) * time_to_expiry_years) / (iv * np.sqrt(time_to_expiry_years))
    gamma = norm.pdf(d1) / (spot * iv * np.sqrt(time_to_expiry_years))
    delta = norm.cdf(d1) if option_type == "call" else norm.cdf(d1) - 1

    return float(delta), float(gamma)


def get_yfinance_spot_price(symbol: str) -> float | None:
    try:
        hist = yf.Ticker(symbol).history(period="1d")
        if hist.empty:
            return None
        return float(hist["Close"].iloc[-1])
    except Exception:
        return None


def get_yfinance_options_snapshot(symbol: str, spot_price: float | None = None, max_expirations: int = MAX_EXPIRATIONS) -> pd.DataFrame:
    try:
        ticker = yf.Ticker(symbol)
        expirations = ticker.options
        if not expirations:
            return pd.DataFrame()

        if spot_price is None:
            hist = ticker.history(period="1d")
            if hist.empty:
                return pd.DataFrame()
            spot_price = float(hist["Close"].iloc[-1])

        today = datetime.now().date()
        rows = []

        for expiry_str in expirations[:max_expirations]:
            expiry_date = datetime.strptime(expiry_str, "%Y-%m-%d").date()
            time_to_expiry = max((expiry_date - today).days, 0) / 365.0
            if time_to_expiry == 0:
                continue

            try:
                chain = ticker.option_chain(expiry_str)
            except Exception:
                continue

            for option_type, df in (("call", chain.calls), ("put", chain.puts)):
                for _, row in df.iterrows():
                    iv = row.get("impliedVolatility")
                    delta, gamma = black_scholes_greeks(spot_price, row["strike"], iv, time_to_expiry, option_type)
                    rows.append(
                        {
                            "contract": row.get("contractSymbol"),
                            "strike": row["strike"],
                            "expiration": expiry_str,
                            "type": option_type,
                            "open_interest": row.get("openInterest", 0) or 0,
                            "implied_volatility": iv,
                            "delta": delta,
                            "gamma": gamma,
                            "volume": row.get("volume", 0) or 0,
                        }
                    )

        return pd.DataFrame(rows)
    except Exception:
        return pd.DataFrame()
