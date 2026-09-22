"""Which option expirations to pull. Pure date logic, kept apart from the yfinance
call so it can be tested without the network.

A 25-delta skew is only meaningful on a standard tenor: SPY lists an expiry every day,
so "the nearest one" is 0-3 days out, where deltas and implied vols are degenerate.
The skew tenor is the listed expiry closest to 30 days, and never under a week.
"""

from __future__ import annotations

from datetime import date, datetime

TARGET_SKEW_DTE = 30
MIN_SKEW_DTE = 7


def _days_to_expiry(expiry: str, today: date) -> int:
    return (datetime.strptime(expiry, "%Y-%m-%d").date() - today).days


def pick_skew_expiration(expirations: list[str] | tuple[str, ...], today: date) -> str | None:
    eligible = [e for e in expirations if _days_to_expiry(e, today) >= MIN_SKEW_DTE]
    if not eligible:
        return None
    return min(eligible, key=lambda e: abs(_days_to_expiry(e, today) - TARGET_SKEW_DTE))


def select_expirations(expirations: list[str] | tuple[str, ...], today: date, max_near: int) -> list[str]:
    """The `max_near` nearest expiries (short-dated flow, for GEX) plus the skew tenor."""
    selected = list(expirations[:max_near])
    skew_expiry = pick_skew_expiration(expirations, today)
    if skew_expiry is not None and skew_expiry not in selected:
        selected.append(skew_expiry)
    return selected
