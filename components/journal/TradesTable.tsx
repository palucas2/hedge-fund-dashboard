"use client";

import { useMemo, useState } from "react";
import type { TradeDTO } from "@/lib/types";
import { STRATEGIES, TAGS } from "@/lib/types";
import { downloadCsv, tradesToCsv } from "@/lib/csv";

function fmtUsd(v: number | null) {
  if (v === null) return "—";
  return `${v >= 0 ? "+" : ""}$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
function fmtPct(v: number | null) {
  if (v === null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

const selectClass = "rounded-button border border-border bg-bg px-2 py-1 text-xs text-text-primary outline-none focus:border-link";

export default function TradesTable({
  trades,
  onEdit,
  onDelete,
  canWrite,
}: {
  trades: TradeDTO[];
  onEdit: (t: TradeDTO) => void;
  onDelete: (id: number) => void;
  canWrite: boolean;
}) {
  const [strategyFilter, setStrategyFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    return trades.filter((t) => {
      if (strategyFilter && t.strategy !== strategyFilter) return false;
      if (tagFilter && t.tags !== tagFilter) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      const refDate = t.exitDate ?? t.entryDate ?? t.createdAt;
      if (from && refDate.slice(0, 10) < from) return false;
      if (to && refDate.slice(0, 10) > to) return false;
      return true;
    });
  }, [trades, strategyFilter, tagFilter, statusFilter, from, to]);

  return (
    <div className="rounded-card border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select className={selectClass} value={strategyFilter} onChange={(e) => setStrategyFilter(e.target.value)}>
          <option value="">Toutes stratégies</option>
          {STRATEGIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select className={selectClass} value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
          <option value="">Tous tags</option>
          {TAGS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select className={selectClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Tous statuts</option>
          <option value="open">Ouvert</option>
          <option value="closed">Clôturé</option>
        </select>
        <input type="date" className={selectClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="text-xs text-text-secondary">→</span>
        <input type="date" className={selectClass} value={to} onChange={(e) => setTo(e.target.value)} />
        <button
          onClick={() => downloadCsv(`trades-${new Date().toISOString().slice(0, 10)}.csv`, tradesToCsv(filtered))}
          className="ml-auto rounded-button border border-border px-3 py-1 text-xs text-text-secondary hover:text-text-primary"
        >
          Export CSV ({filtered.length})
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-text-secondary">
              <th className="py-2 pr-3">Asset</th>
              <th className="py-2 pr-3">Stratégie</th>
              <th className="py-2 pr-3">Dir.</th>
              <th className="py-2 pr-3">Entrée</th>
              <th className="py-2 pr-3">Sortie</th>
              <th className="py-2 pr-3">PnL $</th>
              <th className="py-2 pr-3">PnL %</th>
              <th className="py-2 pr-3">Tag</th>
              <th className="py-2 pr-3">Statut</th>
              {canWrite && <th className="py-2 pr-3"></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-6 text-center text-text-secondary">
                  Aucun trade.
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id} className="border-b border-border/50 text-text-primary">
                  <td className="py-2 pr-3 font-medium">{t.asset}</td>
                  <td className="py-2 pr-3 text-text-secondary">{t.strategy ?? "—"}</td>
                  <td className="py-2 pr-3">
                    <span className={t.direction === "long" ? "text-bull" : "text-bear"}>{t.direction === "long" ? "Long" : "Short"}</span>
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">
                    {t.entryDate?.slice(0, 10) ?? "—"} {t.entryPrice !== null ? `@ ${t.entryPrice}` : ""}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">
                    {t.exitDate?.slice(0, 10) ?? "—"} {t.exitPrice !== null ? `@ ${t.exitPrice}` : ""}
                  </td>
                  <td className={`py-2 pr-3 font-mono ${t.pnlUsd !== null && t.pnlUsd >= 0 ? "text-bull" : t.pnlUsd !== null ? "text-bear" : "text-text-secondary"}`}>
                    {fmtUsd(t.pnlUsd)}
                  </td>
                  <td className={`py-2 pr-3 font-mono ${t.pnlPct !== null && t.pnlPct >= 0 ? "text-bull" : t.pnlPct !== null ? "text-bear" : "text-text-secondary"}`}>
                    {fmtPct(t.pnlPct)}
                  </td>
                  <td className="py-2 pr-3 text-text-secondary">{t.tags ?? "—"}</td>
                  <td className="py-2 pr-3">
                    <span className={`rounded px-1.5 py-0.5 text-xs ${t.status === "open" ? "bg-lateral/20 text-lateral" : "bg-border text-text-secondary"}`}>
                      {t.status === "open" ? "Ouvert" : "Clôturé"}
                    </span>
                  </td>
                  {canWrite && (
                    <td className="py-2 pr-3 text-right">
                      <button onClick={() => onEdit(t)} className="mr-2 text-xs text-link hover:underline">
                        Éditer
                      </button>
                      <button onClick={() => onDelete(t.id)} className="text-xs text-bear hover:underline">
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
  );
}
