"""1D local-linear-trend Kalman filter on closing price: state = [level, trend].
Smooths out noise to estimate the underlying trend direction and a fair-value
level, independent of any external filtering library."""

import numpy as np
import pandas as pd

from src.models.schemas import SignalResult


def _run_kalman(prices: np.ndarray, process_var: float = 1e-4, obs_var: float = 1e-2):
    n = len(prices)
    # state transition: level_t = level_{t-1} + trend_{t-1}; trend_t = trend_{t-1}
    F = np.array([[1, 1], [0, 1]])
    H = np.array([[1, 0]])
    Q = np.eye(2) * process_var
    R = np.array([[obs_var]])

    x = np.array([prices[0], 0.0])  # initial state
    P = np.eye(2)

    levels = np.zeros(n)
    trends = np.zeros(n)

    for t in range(n):
        # predict
        x = F @ x
        P = F @ P @ F.T + Q

        # update
        y = prices[t] - (H @ x)[0]
        S = (H @ P @ H.T + R)[0, 0]
        K = (P @ H.T) / S
        x = x + (K.flatten() * y)
        P = (np.eye(2) - K @ H) @ P

        levels[t] = x[0]
        trends[t] = x[1]

    return levels, trends


def compute(asset: str, price_df: pd.DataFrame) -> SignalResult:
    if price_df.empty or len(price_df) < 20:
        return SignalResult(
            name="kalman_filter",
            asset=asset,
            value={},
            direction="neutral",
            confidence=0.0,
            is_mocked=True,
            note="insufficient price history (<20 obs) to run Kalman filter",
        )

    prices = price_df["close"].values.astype(float)
    levels, trends = _run_kalman(prices)

    latest_price = prices[-1]
    fair_value = levels[-1]
    trend = trends[-1]
    deviation_pct = (latest_price - fair_value) / fair_value * 100

    direction = "bullish" if trend > 0 else "bearish" if trend < 0 else "neutral"
    # confidence scales with how consistent the trend sign has been recently
    recent_trend_signs = np.sign(trends[-10:])
    confidence = float(np.mean(recent_trend_signs == np.sign(trend))) if trend != 0 else 0.3

    return SignalResult(
        name="kalman_filter",
        asset=asset,
        value={
            "fair_value": round(float(fair_value), 4),
            "trend_slope": round(float(trend), 6),
            "price_vs_fair_value_pct": round(float(deviation_pct), 3),
        },
        direction=direction,
        confidence=round(confidence, 3),
        is_mocked=False,
        note="local-linear-trend Kalman filter on close price",
    )
