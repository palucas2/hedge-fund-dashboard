"use client";

/** Widget public officiel TradingView (iframe embed) — aucune clé API requise. */
export default function TradingViewWidget({ symbol, interval }: { symbol: string; interval: string }) {
  const params = new URLSearchParams({
    symbol,
    interval,
    theme: "dark",
    style: "1",
    timezone: "exchange",
    toolbarbg: "12141c",
    studies: "[]",
    hidesidetoolbar: "0",
    saveimage: "0",
    withdateranges: "1",
    hide_top_toolbar: "0",
    hide_legend: "0",
  });

  return (
    <iframe
      key={`${symbol}-${interval}`}
      src={`https://s.tradingview.com/widgetembed/?${params.toString()}`}
      className="h-full w-full rounded-card border border-border"
      title="TradingView Chart"
      allowFullScreen
    />
  );
}
