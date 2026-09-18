/**
 * Cotations : Yahoo Finance (gratuit, sans clé — voir lib/yahoo-finance.ts), testé en
 * conditions réelles. Alpha Vantage n'est plus utilisé pour les prix — seuls les
 * fondamentaux Company (P/E, revenue growth, market cap) restent sur Alpha Vantage,
 * Yahoo n'exposant pas ces données sans contourner une authentification "crumb".
 */
import { getYahooQuote } from "@/lib/yahoo-finance";

type Quote = { price: number; changePercent: number };

export function isMarketDataConfigured() {
  return true; // Yahoo Finance ne nécessite aucune clé
}

export async function getQuote(ticker: string): Promise<Quote | null> {
  const quote = await getYahooQuote(ticker);
  if (!quote) return null;
  return { price: quote.price, changePercent: quote.changePct };
}

export async function getQuotes(tickers: string[]): Promise<Record<string, Quote | null>> {
  const entries = await Promise.all(tickers.map(async (t) => [t, await getQuote(t)] as const));
  return Object.fromEntries(entries);
}

export type CompanyOverview = { peRatio: number | null; revenueGrowth: number | null; marketCap: number | null };

export function isFundamentalsConfigured() {
  return Boolean(process.env.ALPHA_VANTAGE_KEY);
}

/** Fondamentaux Company — spec Module 7 (panel latéral du node). Alpha Vantage requis (Yahoo protégé par auth). */
export async function getCompanyOverview(ticker: string): Promise<CompanyOverview | null> {
  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.Symbol) return null;

    return {
      peRatio: data.PERatio && data.PERatio !== "None" ? Number(data.PERatio) : null,
      revenueGrowth: data.QuarterlyRevenueGrowthYOY && data.QuarterlyRevenueGrowthYOY !== "None" ? Number(data.QuarterlyRevenueGrowthYOY) * 100 : null,
      marketCap: data.MarketCapitalization && data.MarketCapitalization !== "None" ? Number(data.MarketCapitalization) : null,
    };
  } catch {
    return null;
  }
}
