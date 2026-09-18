"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { WheelCycleDTO } from "@/lib/types";
import Modal from "@/components/Modal";
import CycleForm, { type CycleFormValues } from "@/components/wheel/CycleForm";
import CloseCycleForm from "@/components/wheel/CloseCycleForm";
import CurrentCycleCard from "@/components/wheel/CurrentCycleCard";
import CumulativeMetrics from "@/components/wheel/CumulativeMetrics";
import MonteCarloPanel from "@/components/wheel/MonteCarloPanel";
import { computeWheelSharpe } from "@/lib/wheel-metrics";

export default function WheelBtcPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [cycles, setCycles] = useState<WheelCycleDTO[]>([]);
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [closingCycle, setClosingCycle] = useState<WheelCycleDTO | null>(null);
  const [projectedWinRatePct, setProjectedWinRatePct] = useState<number | null>(null);

  async function loadCycles() {
    const res = await fetch("/api/wheel");
    if (res.ok) setCycles(await res.json());
    setLoading(false);
  }

  async function loadBtcPrice() {
    const res = await fetch("/api/btc-price");
    if (res.ok) {
      const data = await res.json();
      setBtcPrice(data.quote?.price ?? null);
    }
  }

  useEffect(() => {
    loadCycles();
    loadBtcPrice();
    const id = setInterval(loadBtcPrice, 30 * 1000);
    return () => clearInterval(id);
  }, []);

  async function handleCreate(values: CycleFormValues) {
    const res = await fetch("/api/wheel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Erreur");
    setShowNewForm(false);
    await loadCycles();
  }

  async function handleClose(values: { result: string; scenario: string; pnl: string }) {
    if (!closingCycle) return;
    const res = await fetch(`/api/wheel/${closingCycle.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, status: "closed" }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Erreur");
    setClosingCycle(null);
    await loadCycles();
  }

  const currentCycle = cycles.find((c) => c.status === "open") ?? null;
  const totalPremiumsToDate = cycles.reduce((sum, c) => sum + (c.premium ?? 0), 0);
  const realizedSharpe = computeWheelSharpe(cycles);

  if (loading) {
    return <p className="p-6 text-sm text-text-secondary">Chargement…</p>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Module 4 — Wheel BTC Tracker</h1>
        <p className="text-sm text-text-secondary">
          BTC live : {btcPrice !== null ? `$${btcPrice.toLocaleString()}` : "—"} (CoinGecko, refresh 30s)
        </p>
      </div>

      <CurrentCycleCard
        cycle={currentCycle}
        btcPrice={btcPrice}
        totalPremiumsToDate={totalPremiumsToDate}
        canWrite={isAdmin}
        onClose={() => setClosingCycle(currentCycle)}
        onNew={() => setShowNewForm(true)}
      />

      <CumulativeMetrics cycles={cycles} projectedWinRatePct={projectedWinRatePct} />

      <MonteCarloPanel
        btcPrice={btcPrice}
        realizedSharpe={realizedSharpe}
        onResult={(result) => setProjectedWinRatePct(100 - result.probLoss)}
      />

      {showNewForm && (
        <Modal title="Nouveau cycle" onClose={() => setShowNewForm(false)}>
          <CycleForm onSubmit={handleCreate} onCancel={() => setShowNewForm(false)} />
        </Modal>
      )}

      {closingCycle && (
        <Modal title="Clôture de cycle" onClose={() => setClosingCycle(null)}>
          <CloseCycleForm cycle={closingCycle} onSubmit={handleClose} onCancel={() => setClosingCycle(null)} />
        </Modal>
      )}
    </div>
  );
}
