"""Writes 'take' TradeSpecs into the dashboard's real `trades` table — this is
what makes forward paper-trading validation possible: a trade logged here
today can be checked against what the market actually did weeks from now,
which no backtest can substitute for (backtests only ever grade against
history that already happened before the code was written).

Only 'take' specs get written (watch/skip aren't trades). One open
signal_engine trade per asset at a time — if a fresh idea points at an asset
that already has an open paper position from this strategy, it's skipped
rather than pyramiding into it.
"""

from __future__ import annotations

from src.models.schemas import TradeSpec
from src.output import db

STRATEGY_TAG = "signal_engine"


def _get_connection():
    return db.get_connection()


def _get_admin_user_id(cur) -> int | None:
    cur.execute("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1")
    row = cur.fetchone()
    return row[0] if row else None


def _has_open_position(cur, asset: str) -> bool:
    cur.execute(
        "SELECT 1 FROM trades WHERE asset = %s AND tags LIKE %s AND status = 'open' LIMIT 1",
        (asset, f"%{STRATEGY_TAG}%"),
    )
    return cur.fetchone() is not None


def write_paper_trades(specs: list[TradeSpec], account_size: float = 100_000) -> int:
    """Returns the count of new paper trades opened."""
    take_specs = [s for s in specs if s.action == "take"]
    if not take_specs:
        return 0

    conn = _get_connection()
    opened = 0
    try:
        with conn:
            with conn.cursor() as cur:
                user_id = _get_admin_user_id(cur)

                for spec in take_specs:
                    if _has_open_position(cur, spec.idea.asset):
                        continue

                    sizing_usd = spec.size_pct * account_size
                    thesis = spec.idea.thesis
                    if spec.idea.news_trigger:
                        thesis = f'Triggered by: "{spec.idea.news_trigger.title}"\n\n{thesis}'

                    cur.execute(
                        """
                        INSERT INTO trades (
                            user_id, asset, strategy, direction,
                            entry_price, entry_date, sizing_usd, sizing_pct,
                            sl, tp1, thesis, tags, status
                        ) VALUES (
                            %s, %s, %s, %s,
                            %s, NOW(), %s, %s,
                            %s, %s, %s, %s, 'open'
                        )
                        """,
                        (
                            user_id,
                            spec.idea.asset,
                            "Algo",  # matches spec's strategy taxonomy (Géopolitique/Wheel BTC/Algo/ETF Thématique/Autre)
                            spec.idea.direction,
                            spec.entry_price,
                            sizing_usd,
                            spec.size_pct,
                            spec.stop_loss,
                            spec.take_profit,
                            thesis,
                            f"{STRATEGY_TAG},conviction_{spec.idea.conviction}",
                        ),
                    )
                    opened += 1
    finally:
        conn.close()

    return opened
