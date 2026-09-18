import { XMLParser } from "fast-xml-parser";

/**
 * Flux RSS investing.com — gratuits, sans clé, pas de rate-limit agressif.
 * Alternative à NewsAPI (délai ~24h sur le plan gratuit, voir lib/news.ts) pour
 * obtenir des news fraîches (souvent < 5 min entre publication et parution ici).
 */
const RSS_FEEDS = [
  "https://www.investing.com/rss/news_14.rss", // Economy News — le plus fréquent
  "https://www.investing.com/rss/news_25.rss", // Stock Market News
  "https://www.investing.com/rss/news_11.rss", // Commodities & Futures News
  "https://www.investing.com/rss/news_1.rss", // Forex News
];

export type RssArticle = {
  title: string;
  description: string;
  url: string;
  publishedAt: string; // ISO
  source: string;
};

const parser = new XMLParser({ ignoreAttributes: false });

/**
 * investing.com renvoie "YYYY-MM-DD HH:mm:ss" en UTC mais SANS marqueur de timezone —
 * `new Date(pubDate)` l'interprète alors comme une heure locale du serveur (bug constaté :
 * décalage de 2h en Europe/Paris), d'où la conversion explicite en UTC ici.
 */
function toIso(pubDate: string): string {
  const isoLike = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(pubDate) ? `${pubDate.replace(" ", "T")}Z` : pubDate;
  const d = new Date(isoLike);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

async function fetchFeed(url: string): Promise<RssArticle[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HedgeFundDashboard/1.0)" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const data = parser.parse(xml);
    const items = data?.rss?.channel?.item;
    const list = Array.isArray(items) ? items : items ? [items] : [];

    return list.map((item: Record<string, unknown>) => ({
      title: String(item.title ?? ""),
      description: String(item.description ?? item.title ?? ""),
      url: String(item.link ?? ""),
      publishedAt: toIso(String(item.pubDate ?? "")),
      source: "Investing.com",
    }));
  } catch {
    return [];
  }
}

export async function getRssNews(sinceHours: number): Promise<RssArticle[]> {
  const results = await Promise.all(RSS_FEEDS.map(fetchFeed));
  const cutoff = Date.now() - sinceHours * 60 * 60 * 1000;
  const seen = new Set<string>();
  const merged: RssArticle[] = [];

  for (const article of results.flat()) {
    if (!article.url || seen.has(article.url)) continue;
    if (new Date(article.publishedAt).getTime() < cutoff) continue;
    seen.add(article.url);
    merged.push(article);
  }

  return merged.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}
