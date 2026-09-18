import type { WheelCycleDTO } from "@/lib/types";
import type { EquityPoint } from "@/lib/trade-metrics";

export type WheelStats = {
  totalPremiums: number;
  cyclesCompleted: number;
  wins: number;
  losses: number;
  ongoing: number;
  winRateReal: number | null;
  pnlTotal: number;
  annualizedReturnPct: number | null; // approx, basé sur la durée réelle depuis le 1er cycle
};

function closedCycles(cycles: WheelCycleDTO[]): WheelCycleDTO[] {
  return cycles
    .filter((c) => c.status === "closed" && c.pnl !== null)
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function computeWheelStats(cycles: WheelCycleDTO[]): WheelStats {
  const closed = closedCycles(cycles);
  const ongoing = cycles.filter((c) => c.status === "open").length;

  const totalPremiums = cycles.reduce((sum, c) => sum + (c.premium ?? 0), 0);
  const pnlTotal = closed.reduce((sum, c) => sum + (c.pnl ?? 0), 0);
  const wins = closed.filter((c) => (c.pnl ?? 0) > 0).length;
  const losses = closed.filter((c) => (c.pnl ?? 0) <= 0).length;

  let annualizedReturnPct: number | null = null;
  if (closed.length > 0) {
    const firstDate = new Date(closed[0].createdAt).getTime();
    const daysSinceInception = Math.max(1, (Date.now() - firstDate) / (1000 * 60 * 60 * 24));
    const totalCapitalProxy = closed.reduce((sum, c) => sum + (c.strike ?? 0), 0) / closed.length || 1;
    annualizedReturnPct = Math.round(((pnlTotal / totalCapitalProxy) * (365 / daysSinceInception)) * 10000) / 100;
  }

  return {
    totalPremiums: Math.round(totalPremiums * 100) / 100,
    cyclesCompleted: closed.length,
    wins,
    losses,
    ongoing,
    winRateReal: closed.length > 0 ? wins / closed.length : null,
    pnlTotal: Math.round(pnlTotal * 100) / 100,
    annualizedReturnPct,
  };
}

/** Sharpe réalisé, non annualisé, basé sur le PnL/strike de chaque cycle clôturé (mêmes hypothèses simplificatrices que lib/trade-metrics.ts). */
export function computeWheelSharpe(cycles: WheelCycleDTO[]): number | null {
  const closed = closedCycles(cycles);
  const returns = closed
    .filter((c) => c.strike && c.strike !== 0)
    .map((c) => ((c.pnl ?? 0) / c.strike!) * 100);
  if (returns.length < 2) return null;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  const sd = Math.sqrt(variance);
  return sd > 0 ? Math.round((mean / sd) * 100) / 100 : null;
}

export function computeWheelEquityCurve(cycles: WheelCycleDTO[]): EquityPoint[] {
  const closed = closedCycles(cycles);
  let cumulative = 0;
  return closed.map((c) => {
    cumulative += c.pnl ?? 0;
    return { date: c.createdAt.slice(0, 10), cumulativePnl: Math.round(cumulative * 100) / 100 };
  });
}
