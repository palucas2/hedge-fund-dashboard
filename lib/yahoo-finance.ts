/** Yahoo Finance chart API — gratuit, sans clé. Endpoint non-officiel mais largement utilisé pour l'historique. */

export type Candle = { timestamp: number; close: number; volume: number | null };

const cache = new Map<string, { value: Candle[]; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h, aligné sur le refresh horaire du spec (régimes daily)

async function fetchChart(symbol: string, range: string, interval: string) {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`,
    { headers: { "User-Agent": "Mozilla/5.0 (compatible; HedgeFundDashboard/1.0)" }, cache: "no-store" }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.chart?.result?.[0] ?? null;
}

function toCandles(result: { timestamp?: number[]; indicators?: { quote?: { close?: (number | null)[]; volume?: (number | null)[] }[] } }): Candle[] {
  const timestamps: number[] = result.timestamp ?? [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
  const volumes: (number | null)[] = result.indicators?.quote?.[0]?.volume ?? [];

  const candles: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] !== null && closes[i] !== undefined) {
      candles.push({ timestamp: timestamps[i], close: closes[i] as number, volume: volumes[i] ?? null });
    }
  }
  return candles;
}

export async function getDailyCloses(symbol: string, rangeDays = 400): Promise<Candle[] | null> {
  const cached = cache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const range = rangeDays > 300 ? "2y" : "1y";
    const result = await fetchChart(symbol, range, "1d");
    if (!result) return null;

    const trimmed = toCandles(result).slice(-rangeDays);
    cache.set(symbol, { value: trimmed, expiresAt: Date.now() + CACHE_TTL_MS });
    return trimmed;
  } catch {
    return null;
  }
}

const intradayCache = new Map<string, { value: Candle[]; expiresAt: number }>();
const INTRADAY_CACHE_TTL_MS = 5 * 60 * 1000;

/** Bougies 5 min de la journée — spec Module 9 : détection de mouvements de prix anormaux (>3%/<1h). */
export async function getIntradayCloses(symbol: string): Promise<Candle[] | null> {
  const cached = intradayCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const result = await fetchChart(symbol, "1d", "5m");
    if (!result) return null;

    const candles = toCandles(result);
    intradayCache.set(symbol, { value: candles, expiresAt: Date.now() + INTRADAY_CACHE_TTL_MS });
    return candles;
  } catch {
    return null;
  }
}

export type YahooQuote = { price: number; changePct: number };

const quoteCache = new Map<string, { value: YahooQuote; expiresAt: number }>();
const QUOTE_CACHE_TTL_MS = 60 * 1000;

export async function getYahooQuote(symbol: string): Promise<YahooQuote | null> {
  const cached = quoteCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; HedgeFundDashboard/1.0)" }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;

    const value: YahooQuote = { price: meta.regularMarketPrice, changePct: meta.regularMarketChangePercent ?? 0 };
    quoteCache.set(symbol, { value, expiresAt: Date.now() + QUOTE_CACHE_TTL_MS });
    return value;
  } catch {
    return null;
  }
}
