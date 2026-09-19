"""Pure sizing/stop-distance math, shared by trade_builder.py (live pipeline)
and tournament/sized_backtest.py (historical validation of the same formula).
Kept separate so the backtest tests the actual production formula, not a
reimplementation of it that could quietly drift out of sync.
"""

from __future__ import annotations

import config


def vol_targeted_size_pct(annual_vol: float, target_annual_vol: float = config.TARGET_ANNUAL_VOL, max_position_pct: float = config.MAX_POSITION_PCT) -> float:
    """Scales down on high-vol assets, never up past max_position_pct."""
    if annual_vol is None or annual_vol <= 0:
        return 0.0
    vol_scale = min(target_annual_vol / annual_vol, 1.0)
    return max_position_pct * vol_scale


def stop_and_target_distance(
    daily_vol: float,
    stop_multiplier: float = config.STOP_LOSS_VOL_MULTIPLIER,
    target_multiplier: float = config.TAKE_PROFIT_VOL_MULTIPLIER,
) -> tuple[float, float]:
    """Returns (stop_distance_pct, target_distance_pct) — fractional distance
    from entry price, direction-agnostic (caller applies +/- based on long/short)."""
    return stop_multiplier * daily_vol, target_multiplier * daily_vol
