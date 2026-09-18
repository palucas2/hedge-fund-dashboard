"use client";

import type { TradeDTO } from "@/lib/types";
import { classifyTradeZone } from "@/lib/trade-color";
import { computeKellyPct } from "@/lib/trade-metrics";

type Quote = { price: number; changePercent: number };

const ZONE_STYLES: Record<string, string> = {
  above_tp1: "bg-bull/15 text-bull",
  between: "bg-lateral/15 text-lateral",
  near_sl: "bg-bear/15 text-bear",
  unknown: "bg-border text-text-secondary",
};

export default function ActiveTradesTable({
  openTrades,
  allTrades,
  quotes,
  onClose,
}: {
  openTrades: TradeDTO[];
  allTrades: TradeDTO[];
  quotes: Record<string, Quote | null>;
  onClose: (trade: TradeDTO) => void;
}) {
  return (
    <div className="rounded-card border border-border bg-card p-4">
      <div className="mb-3 text-sm font-medium text-text-primary">Trades actifs</div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-text-secondary">
              <th className="py-2 pr-3">Asset</th>
              <th className="py-2 pr-3">Dir.</th>
              <th className="py-2 pr-3">Entrée</th>
              <th className="py-2 pr-3">Prix actuel</th>
              <th className="py-2 pr-3">PnL</th>
              <th className="py-2 pr-3">Dist. SL</th>
              <th className="py-2 pr-3">Dist. TP1</th>
              <th className="py-2 pr-3">Kelly</th>
              <th className="py-2 pr-3">Zone</th>
              <th className="py-2 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {openTrades.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-6 text-center text-text-secondary">
                  Aucun trade actif.
                </td>
              </tr>
            ) : (
              openTrades.map((t) => {
                const currentPrice = quotes[t.asset]?.price ?? null;
                const zone = classifyTradeZone({
                  direction: t.direction,
                  entryPrice: t.entryPrice,
                  sl: t.sl,
                  tp1: t.tp1,
                  currentPrice,
                });
                const pnl =
                  currentPrice !== null && t.entryPrice !== null
                    ? (t.direction === "short" ? t.entryPrice - currentPrice : currentPrice - t.entryPrice) *
                      (t.sizingUsd ?? 0) /
                      (t.entryPrice || 1)
                    : null;
                const distSl = currentPrice !== null && t.sl !== null ? currentPrice - t.sl : null;
                const distTp1 = currentPrice !== null && t.tp1 !== null ? t.tp1 - currentPrice : null;
                const kelly = computeKellyPct(allTrades, t.strategy);

                return (
                  <tr key={t.id} className="border-b border-border/50 text-text-primary">
                    <td className="py-2 pr-3 font-medium">{t.asset}</td>
                    <td className="py-2 pr-3">
                      <span className={t.direction === "long" ? "text-bull" : "text-bear"}>{t.direction === "long" ? "Long" : "Short"}</span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{t.entryPrice ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{currentPrice ?? "—"}</td>
                    <td className={`py-2 pr-3 font-mono ${pnl === null ? "text-text-secondary" : pnl >= 0 ? "text-bull" : "text-bear"}`}>
                      {pnl === null ? "—" : `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(0)}`}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-text-secondary">{distSl?.toFixed(2) ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-text-secondary">{distTp1?.toFixed(2) ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-text-secondary">{kelly !== null ? `${(kelly * 100).toFixed(0)}%` : "—"}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded px-1.5 py-0.5 text-xs ${ZONE_STYLES[zone]}`}>
                        {zone === "above_tp1" ? "🟢 TP1+" : zone === "near_sl" ? "🔴 SL proche" : zone === "between" ? "🟡 En cours" : "—"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <button onClick={() => onClose(t)} className="text-xs text-link hover:underline">
                        Fermer le trade
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
