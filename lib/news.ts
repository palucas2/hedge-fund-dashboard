import { classifyCategory, findLocation, type NewsCategory } from "@/lib/geo";
import { getRssNews, type RssArticle } from "@/lib/rss";

export type NewsPinData = {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  summary: string;
  url: string;
  category: NewsCategory;
  lat: number;
  lng: number;
  region: string;
  locationName: string;
};

const GEOPOLITICAL_QUERY =
  '(geopolitics OR "central bank" OR sanctions OR conflict OR earnings OR OPEC) AND (market OR trade OR economy)';

export function isNewsConfigured() {
  // Le flux RSS (lib/rss.ts) ne nécessite aucune clé — les news restent actives même sans NEWS_API_KEY.
  return true;
}

function toPin(article: { title: string; description: string; url: string; publishedAt: string; source: string }): NewsPinData | null {
  const text = `${article.title} ${article.description}`;
  const location = findLocation(text);
  const category = classifyCategory(text);
  if (!location || !category) return null; // pas de pin sans localisation ET catégorie identifiées

  return {
    id: article.url || `${article.title}-${article.publishedAt}`,
    title: article.title,
    source: article.source,
    publishedAt: article.publishedAt,
    summary: article.description.slice(0, 160),
    url: article.url || "#",
    category,
    lat: location.lat,
    lng: location.lng,
    region: location.region,
    locationName: location.name,
  };
}

/** NewsAPI.org /v2/everything — plan gratuit : ~24h de délai d'indexation (voir README). */
async function getNewsApiArticles(timeframeHours: number): Promise<RssArticle[]> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return [];

  const from = new Date(Date.now() - timeframeHours * 60 * 60 * 1000).toISOString();

  try {
    const res = await fetch(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(GEOPOLITICAL_QUERY)}&from=${from}&language=en&sortBy=publishedAt&pageSize=100&apiKey=${apiKey}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const articles: unknown[] = data.articles ?? [];

    return articles.map((raw) => {
      const a = raw as Record<string, unknown>;
      return {
        title: String(a.title ?? ""),
        description: String(a.description ?? ""),
        url: String(a.url ?? ""),
        publishedAt: String(a.publishedAt ?? ""),
        source: String((a.source as Record<string, unknown> | undefined)?.name ?? "Inconnu"),
      };
    });
  } catch {
    return [];
  }
}

/**
 * Combine RSS (investing.com — pas de clé, fraîcheur ~quelques minutes) et NewsAPI
 * (si NEWS_API_KEY renseigné — couverture plus large mais délai ~24h sur le plan gratuit).
 * Géocodage par mots-clés (lib/geo.ts), pas de NLP.
 */
export async function getGeopoliticalNews(timeframeHours: number): Promise<NewsPinData[]> {
  const [rss, newsApi] = await Promise.all([getRssNews(timeframeHours), getNewsApiArticles(timeframeHours)]);

  const seen = new Set<string>();
  const pins: NewsPinData[] = [];
  for (const article of [...rss, ...newsApi]) {
    if (seen.has(article.url)) continue;
    const pin = toPin(article);
    if (!pin) continue;
    seen.add(article.url);
    pins.push(pin);
  }

  return pins.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

export type EntityNewsItem = { title: string; url: string; source: string; publishedAt: string };

/** Spec Module 7 : "Dernières news liées" — NewsAPI query sur le nom de l'entité, + fallback RSS local. */
export async function searchNewsForEntity(name: string): Promise<EntityNewsItem[]> {
  const apiKey = process.env.NEWS_API_KEY;
  const results: RssArticle[] = [];

  if (apiKey) {
    try {
      const res = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(`"${name}"`)}&language=en&sortBy=publishedAt&pageSize=10&apiKey=${apiKey}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        for (const raw of data.articles ?? []) {
          const a = raw as Record<string, unknown>;
          results.push({
            title: String(a.title ?? ""),
            description: "",
            url: String(a.url ?? ""),
            publishedAt: String(a.publishedAt ?? ""),
            source: String((a.source as Record<string, unknown> | undefined)?.name ?? "Inconnu"),
          });
        }
      }
    } catch {
      // ignore, on retombe sur le RSS local ci-dessous
    }
  }

  const rss = await getRssNews(24 * 14);
  const lowerName = name.toLowerCase();
  for (const a of rss) {
    if (a.title.toLowerCase().includes(lowerName)) results.push(a);
  }

  const seen = new Set<string>();
  const unique = results.filter((a) => (seen.has(a.url) ? false : (seen.add(a.url), true)));
  return unique
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 5)
    .map((a) => ({ title: a.title, url: a.url, source: a.source, publishedAt: a.publishedAt }));
}
