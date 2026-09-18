import type { TradeDTO } from "@/lib/types";

export type TradeStats = {
  total: number;
  wins: number;
  losses: number;
  winRate: number | null; // 0-1
  profitFactor: number | null;
  avgWin: number | null;
  avgLoss: number | null; // positive number
  avgWinLossRatio: number | null;
  totalPnlUsd: number;
  maxDrawdownUsd: number | null;
  sharpe: number | null; // non annualisé, basé sur pnlPct par trade clôturé
};

export type EquityPoint = { date: string; cumulativePnl: number };

function closedSortedByDate(trades: TradeDTO[]): TradeDTO[] {
  return trades
    .filter((t) => t.status === "closed" && t.pnlUsd !== null)
    .slice()
    .sort((a, b) => {
      const da = a.exitDate ?? a.entryDate ?? a.createdAt;
      const db = b.exitDate ?? b.entryDate ?? b.createdAt;
      return new Date(da).getTime() - new Date(db).getTime();
    });
}

export function computeEquityCurve(trades: TradeDTO[]): EquityPoint[] {
  const closed = closedSortedByDate(trades);
  let cumulative = 0;
  return closed.map((t) => {
    cumulative += t.pnlUsd ?? 0;
    const date = t.exitDate ?? t.entryDate ?? t.createdAt;
    return { date: date.slice(0, 10), cumulativePnl: Math.round(cumulative * 100) / 100 };
  });
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function computeTradeStats(trades: TradeDTO[]): TradeStats {
  const closed = closedSortedByDate(trades);
  const total = closed.length;
  const wins = closed.filter((t) => (t.pnlUsd ?? 0) > 0);
  const losses = closed.filter((t) => (t.pnlUsd ?? 0) < 0);

  const totalPnlUsd = closed.reduce((sum, t) => sum + (t.pnlUsd ?? 0), 0);
  const grossWin = wins.reduce((sum, t) => sum + (t.pnlUsd ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.pnlUsd ?? 0), 0));

  const avgWin = wins.length > 0 ? grossWin / wins.length : null;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : null;

  let cumulative = 0;
  let peak = 0;
  let maxDrawdownUsd = 0;
  for (const t of closed) {
    cumulative += t.pnlUsd ?? 0;
    peak = Math.max(peak, cumulative);
    maxDrawdownUsd = Math.min(maxDrawdownUsd, cumulative - peak);
  }

  const pctReturns = closed.map((t) => t.pnlPct ?? 0).filter((v) => v !== 0);
  const meanPct = pctReturns.length > 0 ? pctReturns.reduce((a, b) => a + b, 0) / pctReturns.length : 0;
  const sdPct = stdev(pctReturns);

  return {
    total,
    wins: wins.length,
    losses: losses.length,
    winRate: total > 0 ? wins.length / total : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : null,
    avgWin,
    avgLoss,
    avgWinLossRatio: avgWin !== null && avgLoss !== null && avgLoss !== 0 ? avgWin / avgLoss : null,
    totalPnlUsd: Math.round(totalPnlUsd * 100) / 100,
    maxDrawdownUsd: total > 0 ? Math.round(maxDrawdownUsd * 100) / 100 : null,
    sharpe: sdPct > 0 ? meanPct / sdPct : null,
  };
}

/** Kelly % simplifié à partir de l'historique clôturé d'une stratégie. Retourne null si données insuffisantes. */
export function computeKellyPct(trades: TradeDTO[], strategy: string | null): number | null {
  const relevant = strategy ? trades.filter((t) => t.strategy === strategy) : trades;
  const stats = computeTradeStats(relevant);
  if (stats.winRate === null || stats.avgWinLossRatio === null || stats.avgWinLossRatio === 0) return null;
  const kelly = stats.winRate - (1 - stats.winRate) / stats.avgWinLossRatio;
  return Math.max(0, Math.min(1, kelly));
}

export function topTrades(trades: TradeDTO[], n: number, best: boolean): TradeDTO[] {
  return closedSortedByDate(trades)
    .slice()
    .sort((a, b) => (best ? (b.pnlUsd ?? 0) - (a.pnlUsd ?? 0) : (a.pnlUsd ?? 0) - (b.pnlUsd ?? 0)))
    .slice(0, n);
}

export function winRateByStrategy(trades: TradeDTO[]): { strategy: string; winRate: number; count: number }[] {
  const closed = closedSortedByDate(trades);
  const byStrategy = new Map<string, TradeDTO[]>();
  for (const t of closed) {
    const key = t.strategy ?? "Sans stratégie";
    byStrategy.set(key, [...(byStrategy.get(key) ?? []), t]);
  }
  return Array.from(byStrategy.entries()).map(([strategy, ts]) => {
    const stats = computeTradeStats(ts);
    return { strategy, winRate: stats.winRate ?? 0, count: ts.length };
  });
}

const WEEKDAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export function pnlByWeekday(trades: TradeDTO[]): { day: string; pnl: number }[] {
  const closed = closedSortedByDate(trades);
  const totals = new Array(7).fill(0);
  for (const t of closed) {
    const date = new Date(t.exitDate ?? t.entryDate ?? t.createdAt);
    totals[date.getDay()] += t.pnlUsd ?? 0;
  }
  return WEEKDAYS.map((day, i) => ({ day, pnl: Math.round(totals[i] * 100) / 100 }));
}

export function pnlByMonth(trades: TradeDTO[]): { month: string; pnl: number }[] {
  const closed = closedSortedByDate(trades);
  const totals = new Map<string, number>();
  for (const t of closed) {
    const date = t.exitDate ?? t.entryDate ?? t.createdAt;
    const key = date.slice(0, 7); // YYYY-MM
    totals.set(key, (totals.get(key) ?? 0) + (t.pnlUsd ?? 0));
  }
  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, pnl]) => ({ month, pnl: Math.round(pnl * 100) / 100 }));
}

export function pnlByAsset(trades: TradeDTO[]): { asset: string; pnl: number; count: number }[] {
  const closed = closedSortedByDate(trades);
  const totals = new Map<string, { pnl: number; count: number }>();
  for (const t of closed) {
    const cur = totals.get(t.asset) ?? { pnl: 0, count: 0 };
    totals.set(t.asset, { pnl: cur.pnl + (t.pnlUsd ?? 0), count: cur.count + 1 });
  }
  return Array.from(totals.entries())
    .map(([asset, v]) => ({ asset, pnl: Math.round(v.pnl * 100) / 100, count: v.count }))
    .sort((a, b) => b.pnl - a.pnl);
}
