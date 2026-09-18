import StatCard from "@/components/StatCard";
import EquityCurveChart from "@/components/EquityCurveChart";
import type { WheelCycleDTO } from "@/lib/types";
import { computeWheelEquityCurve, computeWheelStats } from "@/lib/wheel-metrics";

function fmtUsd(v: number | null) {
  if (v === null) return "—";
  return `${v >= 0 ? "+" : ""}$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function CumulativeMetrics({
  cycles,
  projectedWinRatePct,
}: {
  cycles: WheelCycleDTO[];
  projectedWinRatePct: number | null;
}) {
  const stats = computeWheelStats(cycles);
  const equity = computeWheelEquityCurve(cycles);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total primes encaissées" value={fmtUsd(stats.totalPremiums)} tone="bull" big />
        <StatCard label="Cycles (win / loss / en cours)" value={`${stats.wins} / ${stats.losses} / ${stats.ongoing}`} />
        <StatCard
          label="Win rate réel vs projeté MC"
          value={`${stats.winRateReal !== null ? (stats.winRateReal * 100).toFixed(0) : "—"}% vs ${projectedWinRatePct !== null ? projectedWinRatePct.toFixed(0) : "—"}%`}
        />
        <StatCard label="PnL total (net)" value={fmtUsd(stats.pnlTotal)} tone={stats.pnlTotal >= 0 ? "bull" : "bear"} />
        <StatCard label="Rendement annualisé réel" value={stats.annualizedReturnPct !== null ? `${stats.annualizedReturnPct.toFixed(1)}%` : "—"} />
      </div>

      <div className="rounded-card border border-border bg-card p-4">
        <div className="mb-2 text-sm font-medium text-text-primary">Equity curve — stratégie Wheel BTC</div>
        <EquityCurveChart data={equity} />
      </div>
    </div>
  );
}
