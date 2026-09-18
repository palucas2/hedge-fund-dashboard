"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import StatCard from "@/components/StatCard";

const inputClass =
  "w-full rounded-button border border-border bg-bg px-3 py-1.5 text-sm text-text-primary outline-none focus:border-link";
const labelClass = "mb-1 block text-xs text-text-secondary";

type Result = {
  meanPnl: number;
  stdevPnl: number;
  sharpeProjected: number | null;
  probLoss: number;
  histogram: { bin: string; count: number }[];
};

export default function MonteCarloPanel({
  btcPrice,
  realizedSharpe,
  onResult,
}: {
  btcPrice: number | null;
  realizedSharpe: number | null;
  onResult: (result: Result) => void;
}) {
  const [spot, setSpot] = useState(btcPrice?.toString() ?? "");
  const [strikePct, setStrikePct] = useState("10");
  const [premiumPct, setPremiumPct] = useState("2");
  const [volAnnual, setVolAnnual] = useState("55");
  const [crashProb, setCrashProb] = useState("5");
  const [days, setDays] = useState("30");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSimulation() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/wheel/monte-carlo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spot: spot || btcPrice,
          strikePct: Number(strikePct) / 100,
          premiumPct: Number(premiumPct) / 100,
          volAnnual: Number(volAnnual) / 100,
          crashProb: Number(crashProb) / 100,
          days,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Erreur");
      const data: Result = await res.json();
      setResult(data);
      onResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-card border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium text-text-primary">Monte Carlo — prochain cycle (1 000 simulations)</div>
        <button
          onClick={runSimulation}
          disabled={running}
          className="rounded-button bg-link px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {running ? "Simulation..." : "Run Simulation"}
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-6">
        <div>
          <label className={labelClass}>Spot BTC ($)</label>
          <input className={inputClass} value={spot} onChange={(e) => setSpot(e.target.value)} placeholder={btcPrice?.toString()} />
        </div>
        <div>
          <label className={labelClass}>Strike (% sous spot)</label>
          <input type="number" className={inputClass} value={strikePct} onChange={(e) => setStrikePct(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Prime (% spot)</label>
          <input type="number" className={inputClass} value={premiumPct} onChange={(e) => setPremiumPct(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Vol annualisée (%)</label>
          <input type="number" className={inputClass} value={volAnnual} onChange={(e) => setVolAnnual(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Crash prob (%)</label>
          <input type="number" className={inputClass} value={crashProb} onChange={(e) => setCrashProb(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Durée (jours)</label>
          <input type="number" className={inputClass} value={days} onChange={(e) => setDays(e.target.value)} />
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-bear">{error}</p>}

      {result && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="PnL moyen projeté" value={`${result.meanPnl >= 0 ? "+" : ""}$${result.meanPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} tone={result.meanPnl >= 0 ? "bull" : "bear"} />
            <StatCard label="Probabilité de perte" value={`${result.probLoss.toFixed(1)}%`} tone="bear" />
            <StatCard label="Sharpe projeté" value={result.sharpeProjected?.toFixed(2) ?? "—"} />
            <StatCard label="Sharpe réalisé" value={realizedSharpe?.toFixed(2) ?? "—"} />
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={result.histogram} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#262936" strokeDasharray="3 3" />
                <XAxis dataKey="bin" stroke="#9396a1" fontSize={10} tickLine={false} interval={2} />
                <YAxis stroke="#9396a1" fontSize={11} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{ background: "#12141c", border: "1px solid #262936", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#9396a1" }}
                  itemStyle={{ color: "#e6e7ec" }}
                />
                <Bar dataKey="count" name="Simulations" fill="#5a8de8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
