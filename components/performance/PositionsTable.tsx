"use client";

import { useMemo } from "react";
import type { PositionDTO } from "@/lib/types";
import StatCard from "@/components/StatCard";

type Quote = { price: number; changePercent: number };

function fmtUsd(v: number | null) {
  if (v === null) return "—";
  return `${v >= 0 ? "+" : ""}$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
function fmtPct(v: number | null) {
  if (v === null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

export default function PositionsTable({
  positions,
  quotes,
  onRefresh,
  refreshing,
  isAdmin,
  onAdd,
  onDelete,
}: {
  positions: PositionDTO[];
  quotes: Record<string, Quote | null>;
  onRefresh: () => void;
  refreshing: boolean;
  isAdmin: boolean;
  onAdd: () => void;
  onDelete: (id: number) => void;
}) {
  const rows = useMemo(
    () =>
      positions.map((p) => {
        const quote = quotes[p.ticker];
        const currentPrice = quote?.price ?? null;
        const pnlUsd = currentPrice !== null ? (currentPrice - p.entryPrice) * p.quantity : null;
        const pnlPct = currentPrice !== null && p.entryPrice !== 0 ? ((currentPrice - p.entryPrice) / p.entryPrice) * 100 : null;
        return { ...p, currentPrice, pnlUsd, pnlPct };
      }),
    [positions, quotes]
  );

  const totalEntryValue = rows.reduce((sum, r) => sum + r.entryPrice * r.quantity, 0);
  const totalPnlUsd = rows.reduce((sum, r) => sum + (r.pnlUsd ?? 0), 0);
  const anyQuote = rows.some((r) => r.currentPrice !== null);
  const portfolioReturnPct = anyQuote && totalEntryValue > 0 ? (totalPnlUsd / totalEntryValue) * 100 : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard label="Alpha généré (portefeuille - S&P 500)" value="—" big />
        <StatCard label="Performance portefeuille" value={fmtPct(portfolioReturnPct)} tone={portfolioReturnPct === null ? "neutral" : portfolioReturnPct >= 0 ? "bull" : "bear"} />
        <StatCard label="PnL portefeuille" value={fmtUsd(anyQuote ? totalPnlUsd : null)} tone={!anyQuote ? "neutral" : totalPnlUsd >= 0 ? "bull" : "bear"} />
      </div>
      <p className="text-xs text-text-secondary">
        Prix live via Yahoo Finance (gratuit, sans clé). Le calcul "Alpha vs S&P 500" n'est pas encore implémenté (indépendant de toute clé — à construire).
      </p>

      <div className="rounded-card border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-medium text-text-primary">Portefeuille ETF</div>
          <div className="flex gap-2">
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="rounded-button border border-border px-3 py-1 text-xs text-text-secondary hover:text-text-primary disabled:opacity-50"
            >
              {refreshing ? "Actualisation..." : "Rafraîchir les prix"}
            </button>
            {isAdmin && (
              <button onClick={onAdd} className="rounded-button bg-link px-3 py-1 text-xs font-medium text-white">
                + Ticker
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-text-secondary">
                <th className="py-2 pr-3">Ticker</th>
                <th className="py-2 pr-3">Entrée</th>
                <th className="py-2 pr-3">Qté</th>
                <th className="py-2 pr-3">Prix live</th>
                <th className="py-2 pr-3">PnL $</th>
                <th className="py-2 pr-3">PnL %</th>
                {isAdmin && <th className="py-2 pr-3"></th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-text-secondary">
                    Aucun ticker suivi.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 text-text-primary">
                    <td className="py-2 pr-3 font-medium">{r.ticker}</td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {r.entryDate.slice(0, 10)} @ {r.entryPrice}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{r.quantity}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{r.currentPrice ?? "—"}</td>
                    <td className={`py-2 pr-3 font-mono ${r.pnlUsd === null ? "text-text-secondary" : r.pnlUsd >= 0 ? "text-bull" : "text-bear"}`}>
                      {fmtUsd(r.pnlUsd)}
                    </td>
                    <td className={`py-2 pr-3 font-mono ${r.pnlPct === null ? "text-text-secondary" : r.pnlPct >= 0 ? "text-bull" : "text-bear"}`}>
                      {fmtPct(r.pnlPct)}
                    </td>
                    {isAdmin && (
                      <td className="py-2 pr-3 text-right">
                        <button onClick={() => onDelete(r.id)} className="text-xs text-bear hover:underline">
                          Suppr.
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
