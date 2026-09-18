import { prisma } from "@/lib/prisma";
import { getDailyCloses, getIntradayCloses } from "@/lib/yahoo-finance";

/**
 * Earnings Surprises (spec Module 9, catégorie 1) : Alpha Vantage EARNINGS (gratuit,
 * 25 req/jour) — Yahoo Finance ne l'expose pas sur l'endpoint public (calendrier
 * protégé par un "crumb" d'auth qu'on ne contourne pas). Cache 12h par ticker pour
 * rester large sous le quota (les résultats trimestriels ne changent pas plus vite).
 */
export function isEarningsConfigured() {
  return Boolean(process.env.ALPHA_VANTAGE_KEY);
}

export type EarningsEvent = {
  ticker: string;
  reportedEPS: number;
  estimatedEPS: number;
  surprisePct: number;
  reportedDate: string;
};

const earningsCache = new Map<string, { value: EarningsEvent | null; expiresAt: number }>();
const EARNINGS_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const FRESHNESS_DAYS = 3; // ne remonter qu'un earnings publié récemment, pas tout l'historique

async function fetchLatestEarnings(ticker: string): Promise<EarningsEvent | null> {
  const cached = earningsCache.get(ticker);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://www.alphavantage.co/query?function=EARNINGS&symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const latest = data.quarterlyEarnings?.[0];
    if (!latest?.surprisePercentage || latest.surprisePercentage === "None") {
      earningsCache.set(ticker, { value: null, expiresAt: Date.now() + EARNINGS_CACHE_TTL_MS });
      return null;
    }

    const reportedDate = new Date(latest.reportedDate);
    const daysSinceReport = (Date.now() - reportedDate.getTime()) / (1000 * 60 * 60 * 24);
    const surprisePct = Number(latest.surprisePercentage);

    const value: EarningsEvent | null =
      daysSinceReport <= FRESHNESS_DAYS && daysSinceReport >= 0 && Math.abs(surprisePct) >= 10
        ? {
            ticker,
            reportedEPS: Number(latest.reportedEPS),
            estimatedEPS: Number(latest.estimatedEPS),
            surprisePct: Math.round(surprisePct * 100) / 100,
            reportedDate: latest.reportedDate,
          }
        : null;

    earningsCache.set(ticker, { value, expiresAt: Date.now() + EARNINGS_CACHE_TTL_MS });
    return value;
  } catch {
    return null;
  }
}

export async function detectEarningsSurprises(): Promise<EarningsEvent[]> {
  if (!isEarningsConfigured()) return [];
  const tickers = await getWatchlistTickers();
  const results = await Promise.all(tickers.map(fetchLatestEarnings));
  return results.filter((e): e is EarningsEvent => e !== null);
}

/** Watchlist réelle de l'app : tickers ETF suivis (positions) + companies Antecede — pas de liste codée en dur séparée. */
async function getWatchlistTickers(): Promise<string[]> {
  const [positions, nodes] = await Promise.all([
    prisma.position.findMany({ select: { ticker: true } }),
    prisma.antecedeNode.findMany({ where: { type: "company", ticker: { not: null } }, select: { ticker: true } }),
  ]);
  const tickers = new Set<string>();
  for (const p of positions) tickers.add(p.ticker);
  for (const n of nodes) if (n.ticker) tickers.add(n.ticker);
  return Array.from(tickers);
}

export type VolumeEvent = { ticker: string; ratio: number; direction: "accumulation" | "distribution" };

/** Spec Module 9, catégorie 2 : volume du jour > 2x moyenne 20 jours. Yahoo Finance (gratuit, sans clé). */
export async function detectUnusualVolume(): Promise<VolumeEvent[]> {
  const tickers = await getWatchlistTickers();
  const events: VolumeEvent[] = [];

  for (const ticker of tickers) {
    const candles = await getDailyCloses(ticker, 21);
    if (!candles || candles.length < 21) continue;

    const today = candles[candles.length - 1];
    const previous20 = candles.slice(-21, -1);
    const volumes = previous20.map((c) => c.volume).filter((v): v is number => v !== null);
    if (volumes.length === 0 || today.volume === null) continue;

    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    if (avgVolume === 0) continue;

    const ratio = today.volume / avgVolume;
    if (ratio >= 2) {
      const priceDirection = today.close >= previous20[previous20.length - 1].close;
      events.push({
        ticker,
        ratio: Math.round(ratio * 100) / 100,
        direction: priceDirection ? "accumulation" : "distribution",
      });
    }
  }

  return events;
}

export type PriceMoveEvent = { ticker: string; changePct: number };

/** Spec Module 9, catégorie 5 : watchlist asset bouge de ±3% en moins d'1h. Yahoo Finance intraday 5min. */
export async function detectAbnormalPriceMoves(): Promise<PriceMoveEvent[]> {
  const tickers = await getWatchlistTickers();
  const events: PriceMoveEvent[] = [];
  const BARS_PER_HOUR = 12; // bougies 5 min

  for (const ticker of tickers) {
    const candles = await getIntradayCloses(ticker);
    if (!candles || candles.length < 2) continue;

    const last = candles[candles.length - 1];
    const refIndex = Math.max(0, candles.length - 1 - BARS_PER_HOUR);
    const reference = candles[refIndex];
    if (reference.close === 0) continue;

    const changePct = ((last.close - reference.close) / reference.close) * 100;
    if (Math.abs(changePct) >= 3) {
      events.push({ ticker, changePct: Math.round(changePct * 100) / 100 });
    }
  }

  return events;
}
