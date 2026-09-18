"use client";

import { useEffect, useState } from "react";
import { YAHOO_QUOTE_COMPATIBLE, FAVORITE_SYMBOLS } from "@/lib/tradingview";

type Quote = { price: number; changePercent: number };

export default function Watchlist({
  activeSymbol,
  onSelect,
}: {
  activeSymbol: string;
  onSelect: (symbol: string) => void;
}) {
  const [quotes, setQuotes] = useState<Record<string, Quote | null>>({});

  useEffect(() => {
    const tickers = FAVORITE_SYMBOLS.map((s) => s.label).filter((l) => YAHOO_QUOTE_COMPATIBLE.has(l));
    if (tickers.length === 0) return;
    fetch(`/api/market-data/quotes?tickers=${tickers.join(",")}`)
      .then((res) => res.json())
      .then((data) => setQuotes(data.quotes))
      .catch(() => {});
  }, []);

  return (
    <div className="w-[200px] shrink-0 rounded-card border border-border bg-card p-3">
      <div className="mb-2 text-xs font-medium text-text-secondary">Watchlist</div>
      <div className="space-y-1">
        {FAVORITE_SYMBOLS.map((s) => {
          const quote = YAHOO_QUOTE_COMPATIBLE.has(s.label) ? quotes[s.label] : undefined;
          const active = s.symbol === activeSymbol;
          return (
            <button
              key={s.symbol}
              onClick={() => onSelect(s.symbol)}
              className={`flex w-full items-center justify-between rounded-button px-2 py-1.5 text-left text-sm ${
                active ? "bg-bg text-text-primary" : "text-text-secondary hover:bg-bg/60 hover:text-text-primary"
              }`}
            >
              <span>{s.label}</span>
              <span className="font-mono text-xs">
                {quote === undefined ? (
                  <span className="text-text-secondary/50">—</span>
                ) : quote === null ? (
                  "—"
                ) : (
                  <span className={quote.changePercent >= 0 ? "text-bull" : "text-bear"}>{quote.price.toFixed(2)}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] leading-tight text-text-secondary">
        Prix live (Yahoo Finance) limités aux tickers actions/ETF pour l'instant.
      </p>
    </div>
  );
}
