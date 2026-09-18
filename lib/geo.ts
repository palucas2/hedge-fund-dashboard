export type TensionZone = {
  id: string;
  label: string;
  /** [lng, lat][] — polygone approximatif, pas une frontière officielle. */
  coordinates: [number, number][];
};

/** Zones de tension permanentes — spec Module 1 : Ormuz, mer Rouge, Taiwan, Ukraine. */
export const TENSION_ZONES: TensionZone[] = [
  {
    id: "hormuz",
    label: "Détroit d'Ormuz",
    coordinates: [
      [55.5, 27.2],
      [57.2, 27.2],
      [57.2, 25.6],
      [55.5, 25.6],
      [55.5, 27.2],
    ],
  },
  {
    id: "red-sea",
    label: "Mer Rouge / Bab-el-Mandeb",
    coordinates: [
      [40.5, 16.5],
      [44.5, 16.5],
      [44.5, 11.5],
      [40.5, 11.5],
      [40.5, 16.5],
    ],
  },
  {
    id: "taiwan-strait",
    label: "Détroit de Taiwan",
    coordinates: [
      [117.5, 26.5],
      [122, 26.5],
      [122, 21.5],
      [117.5, 21.5],
      [117.5, 26.5],
    ],
  },
  {
    id: "ukraine",
    label: "Ukraine",
    coordinates: [
      [22, 52.5],
      [40.5, 52.5],
      [40.5, 44.5],
      [22, 44.5],
      [22, 52.5],
    ],
  },
];

export type NewsCategory = "geopolitical" | "macro" | "corporate" | "commodity";
export type Region = "Middle East" | "Asia" | "Europe" | "Americas";

type KnownLocation = { lat: number; lng: number; region: Region };

/**
 * Dictionnaire lieu → coordonnées, utilisé comme heuristique simple de géocodage
 * (mots-clés dans titre/description → position approximative). Ce n'est pas un
 * géocodage NLP complet — voir lib/news.ts pour la logique d'association.
 */
export const KNOWN_LOCATIONS: Record<string, KnownLocation> = {
  iran: { lat: 32, lng: 53, region: "Middle East" },
  israel: { lat: 31.5, lng: 34.8, region: "Middle East" },
  gaza: { lat: 31.5, lng: 34.45, region: "Middle East" },
  yemen: { lat: 15.5, lng: 48.5, region: "Middle East" },
  "saudi arabia": { lat: 24, lng: 45, region: "Middle East" },
  saudi: { lat: 24, lng: 45, region: "Middle East" },
  "red sea": { lat: 20, lng: 38, region: "Middle East" },
  hormuz: { lat: 26.5, lng: 56, region: "Middle East" },
  iraq: { lat: 33, lng: 44, region: "Middle East" },
  syria: { lat: 35, lng: 38.5, region: "Middle East" },
  lebanon: { lat: 33.9, lng: 35.5, region: "Middle East" },
  qatar: { lat: 25.3, lng: 51.2, region: "Middle East" },
  uae: { lat: 24, lng: 54, region: "Middle East" },

  taiwan: { lat: 23.7, lng: 121, region: "Asia" },
  china: { lat: 35, lng: 105, region: "Asia" },
  "north korea": { lat: 40, lng: 127, region: "Asia" },
  "south korea": { lat: 36, lng: 128, region: "Asia" },
  japan: { lat: 36, lng: 138, region: "Asia" },
  india: { lat: 21, lng: 78, region: "Asia" },
  pakistan: { lat: 30, lng: 70, region: "Asia" },
  singapore: { lat: 1.35, lng: 103.8, region: "Asia" },

  ukraine: { lat: 48.5, lng: 31.5, region: "Europe" },
  russia: { lat: 61, lng: 90, region: "Europe" },
  "european union": { lat: 50, lng: 10, region: "Europe" },
  eu: { lat: 50, lng: 10, region: "Europe" },
  ecb: { lat: 50.1, lng: 8.7, region: "Europe" },
  brussels: { lat: 50.85, lng: 4.35, region: "Europe" },
  uk: { lat: 54, lng: -2, region: "Europe" },
  britain: { lat: 54, lng: -2, region: "Europe" },
  germany: { lat: 51, lng: 10, region: "Europe" },
  france: { lat: 46, lng: 2, region: "Europe" },
  poland: { lat: 52, lng: 19, region: "Europe" },

  "united states": { lat: 38, lng: -97, region: "Americas" },
  fed: { lat: 38.9, lng: -77, region: "Americas" },
  "federal reserve": { lat: 38.9, lng: -77, region: "Americas" },
  venezuela: { lat: 8, lng: -66, region: "Americas" },
  mexico: { lat: 23, lng: -102, region: "Americas" },
  brazil: { lat: -10, lng: -55, region: "Americas" },
  canada: { lat: 56, lng: -106, region: "Americas" },
};

const CATEGORY_KEYWORDS: Record<NewsCategory, string[]> = {
  geopolitical: ["strike", "missile", "sanction", "blockade", "escalation", "ceasefire", "conflict", "war", "attack", "tension"],
  macro: ["fed", "ecb", "boj", "boe", "rba", "rate", "inflation", "gdp", "central bank", "fomc"],
  commodity: ["oil", "opec", "gas", "gold", "wheat", "copper", "lng", "crude"],
  corporate: ["earnings", "revenue", "ipo", "merger", "acquisition", "quarterly"],
};

export function classifyCategory(text: string): NewsCategory | null {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [NewsCategory, string[]][]) {
    if (keywords.some((k) => lower.includes(k))) return category;
  }
  return null;
}

export function findLocation(text: string): (KnownLocation & { name: string }) | null {
  const lower = text.toLowerCase();
  const entries = Object.entries(KNOWN_LOCATIONS).sort((a, b) => b[0].length - a[0].length);
  for (const [name, loc] of entries) {
    if (lower.includes(name)) return { ...loc, name };
  }
  return null;
}

export const CATEGORY_COLORS: Record<NewsCategory, string> = {
  geopolitical: "#EF5350",
  macro: "#FFA726",
  corporate: "#26A69A",
  commodity: "#5a8de8",
};

export const CATEGORY_LABELS: Record<NewsCategory, string> = {
  geopolitical: "Géopolitique / conflit",
  macro: "Macro / banques centrales",
  corporate: "Corporate / earnings",
  commodity: "Commodités",
};
