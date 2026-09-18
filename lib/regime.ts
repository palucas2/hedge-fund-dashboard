import { getDailyCloses } from "@/lib/yahoo-finance";
import { fitGaussianHmm } from "@/lib/hmm";

export const REGIME_ASSETS = [
  { id: "spx", label: "S&P 500", symbol: "^GSPC" },
  { id: "nq", label: "NQ (Nasdaq 100)", symbol: "^NDX" },
  { id: "btc", label: "BTC", symbol: "BTC-USD" },
  { id: "gold", label: "Gold", symbol: "GC=F" },
  { id: "wti", label: "WTI", symbol: "CL=F" },
  { id: "eurusd", label: "EUR/USD", symbol: "EURUSD=X" },
] as const;

export type RegimeLabel = "bull" | "bear" | "lateral";

export type RegimeResult = {
  assetId: string;
  label: string;
  bull: number;
  bear: number;
  lateral: number;
  regime: RegimeLabel;
  timeline: { date: string; regime: RegimeLabel }[]; // 30 derniers jours
  candleCount: number;
};

const CANDLES = 300; // spec : calcul sur les 300 dernières bougies daily

/**
 * HMM gaussien 3 états fit par Baum-Welch sur les log-returns journaliers réels
 * (voir lib/hmm.ts, lib/yahoo-finance.ts). Les états sont triés par rendement moyen
 * croissant pour être étiquetés bear/lateral/bull — pas de mapping arbitraire.
 */
export async function computeRegime(assetId: string): Promise<RegimeResult | null> {
  const asset = REGIME_ASSETS.find((a) => a.id === assetId);
  if (!asset) return null;

  const candles = await getDailyCloses(asset.symbol, CANDLES + 1);
  if (!candles || candles.length < 60) return null; // pas assez d'historique pour un fit fiable

  const returns: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    returns.push(Math.log(candles[i].close / candles[i - 1].close));
  }

  const fit = fitGaussianHmm(returns, 3);

  const order = fit.mu.map((mu, i) => ({ i, mu })).sort((a, b) => a.mu - b.mu);
  const bearIdx = order[0].i;
  const lateralIdx = order[1].i;
  const bullIdx = order[2].i;

  const lastGamma = fit.gamma[fit.gamma.length - 1];
  const bull = lastGamma[bullIdx];
  const bear = lastGamma[bearIdx];
  const lateral = lastGamma[lateralIdx];

  const regime: RegimeLabel = bull >= bear && bull >= lateral ? "bull" : bear >= lateral ? "bear" : "lateral";

  const timelineLength = Math.min(30, fit.gamma.length);
  const timeline = fit.gamma.slice(-timelineLength).map((g, offset) => {
    const candleIndex = candles.length - timelineLength + offset;
    const label: RegimeLabel = g[bullIdx] >= g[bearIdx] && g[bullIdx] >= g[lateralIdx] ? "bull" : g[bearIdx] >= g[lateralIdx] ? "bear" : "lateral";
    return { date: new Date(candles[candleIndex].timestamp * 1000).toISOString().slice(0, 10), regime: label };
  });

  return {
    assetId: asset.id,
    label: asset.label,
    bull: Math.round(bull * 1000) / 10,
    bear: Math.round(bear * 1000) / 10,
    lateral: Math.round(lateral * 1000) / 10,
    regime,
    timeline,
    candleCount: candles.length,
  };
}

export async function computeAllRegimes(): Promise<RegimeResult[]> {
  const results = await Promise.all(REGIME_ASSETS.map((a) => computeRegime(a.id)));
  return results.filter((r): r is RegimeResult => r !== null);
}

/** Régime dominant global = régime majoritaire parmi les assets suivis (spec Module 5). */
export function computeGlobalRegime(results: RegimeResult[]): RegimeLabel | null {
  if (results.length === 0) return null;
  const counts: Record<RegimeLabel, number> = { bull: 0, bear: 0, lateral: 0 };
  for (const r of results) counts[r.regime]++;
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]) as RegimeLabel;
}

export const SIZING_RECOMMENDATIONS: Record<RegimeLabel, string> = {
  bull: "Sizing normal (100%)",
  bear: "Réduire de 50% — éviter nouveaux longs",
  lateral: "Éviter les positions directionnelles — Wheel BTC favorable",
};
