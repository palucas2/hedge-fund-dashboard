export type TradeZone = "above_tp1" | "between" | "near_sl" | "unknown";

/** Code couleur spec Module 2B : vert au-dessus de TP1, jaune entre entrée et TP1, rouge à <10% du SL. */
export function classifyTradeZone(params: {
  direction: string;
  entryPrice: number | null;
  sl: number | null;
  tp1: number | null;
  currentPrice: number | null;
}): TradeZone {
  const { direction, entryPrice, sl, tp1, currentPrice } = params;
  if (currentPrice === null || entryPrice === null) return "unknown";

  const sign = direction === "short" ? -1 : 1;

  if (sl !== null) {
    const range = sign * (entryPrice - sl);
    if (range !== 0) {
      const distFrac = (sign * (currentPrice - sl)) / range;
      if (distFrac <= 0.1) return "near_sl";
    }
  }

  if (tp1 !== null && sign * (currentPrice - tp1) >= 0) return "above_tp1";

  return "between";
}
