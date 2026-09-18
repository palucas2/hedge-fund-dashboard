/** pnlPct est stocké en points de pourcentage (12.34 = +12.34%). */
export function computePnl(params: {
  direction: string;
  entryPrice: number | null;
  exitPrice: number | null;
  sizingUsd: number | null;
}): { pnlUsd: number | null; pnlPct: number | null } {
  const { direction, entryPrice, exitPrice, sizingUsd } = params;
  if (entryPrice === null || exitPrice === null || entryPrice === 0) {
    return { pnlUsd: null, pnlPct: null };
  }
  const rawReturn = (exitPrice - entryPrice) / entryPrice;
  const signedReturn = direction === "short" ? -rawReturn : rawReturn;
  const pnlPct = Math.round(signedReturn * 10000) / 100;
  const pnlUsd = sizingUsd !== null ? Math.round(signedReturn * sizingUsd * 100) / 100 : null;
  return { pnlUsd, pnlPct };
}
