"use client";

import { useState } from "react";
import TradingViewWidget from "@/components/tradingview/TradingViewWidget";
import Watchlist from "@/components/tradingview/Watchlist";
import { FAVORITE_SYMBOLS, TIMEFRAMES, tradingViewChartUrl } from "@/lib/tradingview";

const MARKOV_SCRIPT_URL = process.env.NEXT_PUBLIC_MARKOV_SCRIPT_URL;

export default function TradingViewPage() {
  const [symbol, setSymbol] = useState<string>(FAVORITE_SYMBOLS[0].symbol);
  const [interval, setInterval_] = useState<string>("D");

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold text-text-primary">Module 3 — TradingView</h1>

        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="ml-auto rounded-button border border-border bg-card px-2 py-1 text-sm text-text-primary outline-none focus:border-link"
        >
          {FAVORITE_SYMBOLS.map((s) => (
            <option key={s.symbol} value={s.symbol}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          value={interval}
          onChange={(e) => setInterval_(e.target.value)}
          className="rounded-button border border-border bg-card px-2 py-1 text-sm text-text-primary outline-none focus:border-link"
        >
          {TIMEFRAMES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <a
          href={tradingViewChartUrl(symbol)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-button border border-border px-3 py-1 text-sm text-text-secondary hover:text-text-primary"
        >
          Open in TradingView ↗
        </a>

        {MARKOV_SCRIPT_URL ? (
          <a
            href={MARKOV_SCRIPT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-button border border-border px-3 py-1 text-sm text-link hover:underline"
          >
            Markov Regime Detector ↗
          </a>
        ) : (
          <span
            className="rounded-button border border-border px-3 py-1 text-sm text-text-secondary/50"
            title="Configure NEXT_PUBLIC_MARKOV_SCRIPT_URL une fois le script publié (Module 5)"
          >
            Markov Regime Detector
          </span>
        )}
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="flex-1">
          <TradingViewWidget symbol={symbol} interval={interval} />
        </div>
        <Watchlist activeSymbol={symbol} onSelect={setSymbol} />
      </div>
    </div>
  );
}
