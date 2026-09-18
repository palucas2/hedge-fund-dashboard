// Symboles pour le widget embed public (pas de compte requis). Certains index/futures
// "cash" (ex: SP:SPX, CME_MINI:NQ1!) sont réservés à tradingview.com et renvoient
// "only available on TradingView" dans le widget — on utilise les équivalents CFD
// broker librement embarquables à la place.
export const FAVORITE_SYMBOLS = [
  { symbol: "FOREXCOM:SPXUSD", label: "SPX" },
  { symbol: "FOREXCOM:NSXUSD", label: "NQ" },
  { symbol: "OANDA:XAUUSD", label: "XAUUSD" },
  { symbol: "TVC:USOIL", label: "USOIL" },
  { symbol: "COINBASE:BTCUSD", label: "BTCUSD" },
  { symbol: "OANDA:EURUSD", label: "EURUSD" },
  { symbol: "NYSE:RTX", label: "RTX" },
  { symbol: "NYSE:NOK", label: "NOK" },
  { symbol: "AMEX:XLE", label: "XLE" },
  { symbol: "NASDAQ:CIBR", label: "CIBR" },
] as const;

export const TIMEFRAMES = [
  { value: "5", label: "5m" },
  { value: "15", label: "15m" },
  { value: "60", label: "1h" },
  { value: "240", label: "4h" },
  { value: "D", label: "D" },
  { value: "W", label: "W" },
] as const;

/** Tickers actions/ETF "plain" résolubles directement via Yahoo Finance (voir lib/yahoo-finance.ts). */
export const YAHOO_QUOTE_COMPATIBLE = new Set(["RTX", "NOK", "XLE", "CIBR"]);

export function tradingViewChartUrl(symbol: string) {
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;
}
