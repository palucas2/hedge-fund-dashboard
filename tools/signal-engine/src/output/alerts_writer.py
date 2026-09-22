"""Writes TradeSpecs into the dashboard's real `alerts` table (Postgres/Neon —
the same DB the Next.js app at ../../ reads from for Module 9, Volatility &
Event Tracker). "skip" specs are never written — there's no value alerting on
a call the system itself decided not to act on; only "watch" and "take" reach
the table.

Direct psycopg2, not Prisma: the Next.js side's `prisma db pull`/`migrate`
can't reach Postgres from this sandbox (its Rust query engine's connection
handling trips on something the sandbox's network layer doesn't like), but
plain psycopg2 connects fine — this is a Prisma-specific quirk in this
environment, not a real network restriction, so this writer works the same
way in production as it does here.
"""

from __future__ import annotations

from src.models.schemas import TradeSpec
from src.output import db

DEDUPE_WINDOW_HOURS = 24


def _severity(spec: TradeSpec) -> str:
    if spec.action == "take":
        return "red" if spec.idea.conviction >= 80 else "orange"
    return "yellow"


def _relevance_score(spec: TradeSpec) -> int:
    return max(1, min(5, round(spec.idea.conviction / 20)))


def _title(spec: TradeSpec) -> str:
    return f"{spec.idea.direction.upper()} {spec.idea.asset} — conviction {spec.idea.conviction}/100"


def _description(spec: TradeSpec) -> str:
    lines = [spec.rationale]
    if spec.action == "take":
        lines.append(
            f"Entry {spec.entry_price} | size {spec.size_pct:.2%} of capital | "
            f"SL {spec.stop_loss} | TP {spec.take_profit}"
        )
    if spec.idea.news_trigger:
        lines.append(f'Triggered by: "{spec.idea.news_trigger.title}"')
    return "\n".join(lines)


def _get_connection():
    return db.get_connection()


def _already_alerted(cur, asset: str, title: str) -> bool:
    # DEDUPE_WINDOW_HOURS is a fixed internal constant, not user input — baked into
    # the query text directly rather than bound as a parameter, since a parameter
    # can't sit inside the INTERVAL string literal once bound server-side (true for
    # the HTTP fallback connection; psycopg2 only tolerated it via client-side
    # string substitution, which would have broken silently under that path).
    cur.execute(
        f"""
        SELECT 1 FROM alerts
        WHERE asset = %s AND title = %s
          AND created_at > NOW() - INTERVAL '{DEDUPE_WINDOW_HOURS} hours'
        LIMIT 1
        """,
        (asset, title),
    )
    return cur.fetchone() is not None


def write_trade_specs(specs: list[TradeSpec]) -> int:
    """Writes take/watch specs as alerts, skipping ones already alerted on the
    same asset+title within DEDUPE_WINDOW_HOURS. Returns the count inserted."""
    actionable = [s for s in specs if s.action in ("take", "watch")]
    if not actionable:
        return 0

    conn = _get_connection()
    inserted = 0
    try:
        with conn:
            with conn.cursor() as cur:
                for spec in actionable:
                    title = _title(spec)
                    if _already_alerted(cur, spec.idea.asset, title):
                        continue
                    cur.execute(
                        """
                        INSERT INTO alerts (type, asset, title, description, severity, relevance_score)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        """,
                        (
                            "signal_engine",
                            spec.idea.asset,
                            title,
                            _description(spec),
                            _severity(spec),
                            _relevance_score(spec),
                        ),
                    )
                    inserted += 1
    finally:
        conn.close()

    return inserted
