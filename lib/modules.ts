export type ModuleDef = {
  index: number;
  slug: string;
  path: string;
  label: string;
  icon: string;
  /** Trade Journal reste éditable en Viewer ; tous les autres modules sont read-only pour ce rôle (spec 3.3). */
  viewerWritable: boolean;
};

export const MODULES: ModuleDef[] = [
  { index: 1, slug: "map", path: "/map", label: "Map Monde", icon: "🗺️", viewerWritable: false },
  { index: 2, slug: "performance", path: "/performance", label: "Dashboard Performance", icon: "📊", viewerWritable: false },
  { index: 3, slug: "tradingview", path: "/tradingview", label: "TradingView", icon: "📈", viewerWritable: false },
  { index: 4, slug: "wheel-btc", path: "/wheel-btc", label: "Wheel BTC Tracker", icon: "🎡", viewerWritable: false },
  { index: 5, slug: "regime", path: "/regime", label: "Regime Detector", icon: "🌡️", viewerWritable: false },
  { index: 6, slug: "market-recap", path: "/market-recap", label: "Market Recap", icon: "📰", viewerWritable: false },
  { index: 7, slug: "antecede", path: "/antecede", label: "Antecede Graph", icon: "🕸️", viewerWritable: false },
  { index: 8, slug: "journal", path: "/journal", label: "Trade Journal", icon: "📓", viewerWritable: true },
  { index: 9, slug: "volatility", path: "/volatility", label: "Volatility Tracker", icon: "⚡", viewerWritable: false },
];
