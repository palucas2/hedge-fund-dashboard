import StatCard from "@/components/StatCard";
import type { TradeDTO } from "@/lib/types";
import { computeTradeStats } from "@/lib/trade-metrics";

export default function PerformanceMetrics({ trades }: { trades: TradeDTO[] }) {
  const stats = computeTradeStats(trades);

  return (
    <div className="rounded-card border border-border bg-card p-4">
      <div className="mb-3 text-sm font-medium text-text-primary">Métriques globales</div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Sharpe ratio" value={stats.sharpe !== null ? stats.sharpe.toFixed(2) : "—"} />
        <StatCard label="Win rate global" value={stats.winRate !== null ? `${(stats.winRate * 100).toFixed(0)}%` : "—"} />
        <StatCard
          label="Profit factor"
          value={stats.profitFactor === null ? "—" : stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)}
        />
        <StatCard label="Max drawdown" value={stats.maxDrawdownUsd !== null ? `$${stats.maxDrawdownUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"} tone="bear" />
        <StatCard label="Avg win" value={stats.avgWin !== null ? `+$${stats.avgWin.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"} tone="bull" />
        <StatCard label="Avg loss" value={stats.avgLoss !== null ? `-$${stats.avgLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"} tone="bear" />
        <StatCard label="Alpha cumulé vs S&P 500" value="—" />
        <StatCard label="Trades (total / W / L)" value={`${stats.total} / ${stats.wins} / ${stats.losses}`} />
      </div>
    </div>
  );
}
