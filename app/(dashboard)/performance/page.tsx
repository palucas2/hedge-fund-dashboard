"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { MarketRecapDTO, PositionDTO, TradeDTO } from "@/lib/types";
import Modal from "@/components/Modal";
import PositionForm, { type PositionFormValues } from "@/components/performance/PositionForm";
import PositionsTable from "@/components/performance/PositionsTable";
import ActiveTradesTable from "@/components/performance/ActiveTradesTable";
import PerformanceMetrics from "@/components/performance/PerformanceMetrics";
import CloseTradeForm from "@/components/performance/CloseTradeForm";
import EquityCurveChart from "@/components/EquityCurveChart";
import { computeEquityCurve } from "@/lib/trade-metrics";

type Quote = { price: number; changePercent: number };

export default function PerformancePage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [positions, setPositions] = useState<PositionDTO[]>([]);
  const [trades, setTrades] = useState<TradeDTO[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote | null>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPositionForm, setShowPositionForm] = useState(false);
  const [closingTrade, setClosingTrade] = useState<TradeDTO | null>(null);
  const [pinnedRecap, setPinnedRecap] = useState<MarketRecapDTO | null>(null);

  async function loadData() {
    const [posRes, tradesRes, recapRes] = await Promise.all([
      fetch("/api/positions"),
      fetch("/api/trades"),
      fetch("/api/market-recap"),
    ]);
    if (posRes.ok) setPositions(await posRes.json());
    if (tradesRes.ok) setTrades(await tradesRes.json());
    if (recapRes.ok) setPinnedRecap((await recapRes.json()).recaps.find((r: MarketRecapDTO) => r.pinned) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const openTrades = trades.filter((t) => t.status === "open");

  async function refreshQuotes() {
    const tickers = Array.from(new Set([...positions.map((p) => p.ticker), ...openTrades.map((t) => t.asset)]));
    if (tickers.length === 0) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/market-data/quotes?tickers=${encodeURIComponent(tickers.join(","))}`);
      if (res.ok) {
        const data = await res.json();
        setQuotes(data.quotes);
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function handleAddPosition(values: PositionFormValues) {
    const res = await fetch("/api/positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Erreur");
    setShowPositionForm(false);
    await loadData();
  }

  async function handleDeletePosition(id: number) {
    if (!confirm("Retirer ce ticker du portefeuille ?")) return;
    await fetch(`/api/positions/${id}`, { method: "DELETE" });
    await loadData();
  }

  async function handleCloseTrade(values: { exitDate: string; exitPrice: string }) {
    if (!closingTrade) return;
    const res = await fetch(`/api/trades/${closingTrade.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, status: "closed" }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Erreur");
    setClosingTrade(null);
    await loadData();
  }

  if (loading) {
    return <p className="p-6 text-sm text-text-secondary">Chargement…</p>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Module 2 — Dashboard Performance</h1>
        <p className="text-sm text-text-secondary">Portefeuille ETF, trades actifs et métriques globales.</p>
      </div>

      {pinnedRecap && (
        <Link
          href="/market-recap"
          className="block rounded-card border border-lateral/40 bg-lateral/10 p-4 hover:bg-lateral/15"
        >
          <div className="mb-1 text-sm font-medium text-lateral">★ Alpha du jour — Market Recap {pinnedRecap.date.slice(0, 10)}</div>
          <p className="line-clamp-2 text-xs text-text-secondary">
            {pinnedRecap.content
              .split("\n")
              .find((l) => l.trim() && !l.trim().startsWith("##")) ?? "Voir le brief complet →"}
          </p>
        </Link>
      )}

      <PositionsTable
        positions={positions}
        quotes={quotes}
        onRefresh={refreshQuotes}
        refreshing={refreshing}
        isAdmin={isAdmin}
        onAdd={() => setShowPositionForm(true)}
        onDelete={handleDeletePosition}
      />

      <ActiveTradesTable openTrades={openTrades} allTrades={trades} quotes={quotes} onClose={setClosingTrade} />

      <div className="rounded-card border border-border bg-card p-4">
        <div className="mb-2 text-sm font-medium text-text-primary">Equity curve (trades clôturés)</div>
        <EquityCurveChart data={computeEquityCurve(trades)} />
      </div>

      <PerformanceMetrics trades={trades} />

      {showPositionForm && (
        <Modal title="Ajouter un ticker" onClose={() => setShowPositionForm(false)}>
          <PositionForm onSubmit={handleAddPosition} onCancel={() => setShowPositionForm(false)} />
        </Modal>
      )}

      {closingTrade && (
        <Modal title={`Fermer — ${closingTrade.asset}`} onClose={() => setClosingTrade(null)}>
          <CloseTradeForm trade={closingTrade} onSubmit={handleCloseTrade} onCancel={() => setClosingTrade(null)} />
        </Modal>
      )}
    </div>
  );
}
