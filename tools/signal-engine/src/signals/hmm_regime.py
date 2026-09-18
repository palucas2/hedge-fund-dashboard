"""Regime detection via Gaussian HMM on daily returns — 3 hidden states mapped
to Bull / Bear / Lateral by their fitted mean return (highest mean = Bull,
lowest = Bear, remaining = Lateral)."""

import numpy as np
import pandas as pd
from hmmlearn.hmm import GaussianHMM

from src.models.schemas import SignalResult


def compute(asset: str, price_df: pd.DataFrame, n_states: int = 3) -> SignalResult:
    if price_df.empty or len(price_df) < 60:
        return SignalResult(
            name="hmm_regime",
            asset=asset,
            value={},
            direction="neutral",
            confidence=0.0,
            is_mocked=True,
            note="insufficient price history (<60 obs) to fit HMM",
        )

    returns = price_df["close"].pct_change().dropna().values.reshape(-1, 1)

    model = GaussianHMM(n_components=n_states, covariance_type="diag", n_iter=200, random_state=42)
    model.fit(returns)

    state_means = model.means_.flatten()
    order = np.argsort(state_means)  # ascending: bear, lateral, bull
    labels = {order[0]: "bear", order[1]: "lateral", order[-1]: "bull"}

    posteriors = model.predict_proba(returns)
    latest = posteriors[-1]

    probs = {labels[i]: float(latest[i]) for i in range(n_states)}
    dominant = max(probs, key=probs.get)
    direction = {"bull": "bullish", "bear": "bearish", "lateral": "neutral"}[dominant]

    return SignalResult(
        name="hmm_regime",
        asset=asset,
        value={"probabilities": probs, "dominant_regime": dominant},
        direction=direction,
        confidence=probs[dominant],
        is_mocked=False,
        note=f"HMM fit on {len(returns)} daily returns",
    )
