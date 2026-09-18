/** CoinGecko — gratuit, sans clé. Cache court pour éviter de spammer l'API publique. */

type BtcQuote = { price: number; change24hPct: number };

let cache: { value: BtcQuote; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30 * 1000;

export async function getBtcPrice(): Promise<BtcQuote | null> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true",
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const btc = data.bitcoin;
    if (!btc?.usd) return null;

    const value: BtcQuote = { price: btc.usd, change24hPct: btc.usd_24h_change ?? 0 };
    cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  } catch {
    return null;
  }
}
