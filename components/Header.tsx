"use client";

import { useEffect, useState } from "react";
import {
  useGetBtcPriceQuery,
  useGetRegimeQuery,
  useGetSpxPriceQuery,
  useGetUnreadAlertsCountQuery,
} from "@/lib/store/api";

type ClockZone = { label: string; timeZone: string };

const ZONES: ClockZone[] = [
  { label: "US-E", timeZone: "America/New_York" },
  { label: "EU", timeZone: "Europe/Paris" },
  { label: "HK", timeZone: "Asia/Hong_Kong" },
];

function formatTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export default function Header() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // spec : refresh BTC toutes les 5s — 30s ici (CoinGecko public, pas de WebSocket dédié)
  const { data: btcData } = useGetBtcPriceQuery(undefined, { pollingInterval: 30 * 1000 });
  const { data: spxData } = useGetSpxPriceQuery(undefined, { pollingInterval: 60 * 1000 });
  // spec : régimes daily, refresh horaire
  const { data: regimeData } = useGetRegimeQuery(undefined, { pollingInterval: 60 * 60 * 1000 });
  const { data: alertsData } = useGetUnreadAlertsCountQuery(undefined, { pollingInterval: 2 * 60 * 1000 });

  const btcPrice = btcData?.quote?.price ?? null;
  const spxPrice = spxData?.quote?.price ?? null;
  const dominantRegime = regimeData?.globalRegime ?? null;
  const unreadAlerts = alertsData?.count ?? 0;

  const regimeDot =
    dominantRegime === "bull" ? "🟢" : dominantRegime === "bear" ? "🔴" : dominantRegime === "lateral" ? "🟡" : "⚪";

  return (
    <header className="fixed left-[240px] right-0 top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-bg px-6">
      <div className="flex items-center gap-5 font-mono text-sm text-text-secondary">
        {ZONES.map((z) => (
          <div key={z.timeZone} className="flex items-center gap-1.5">
            <span className="text-text-secondary">{z.label}</span>
            <span className="text-text-primary">{now ? formatTime(now, z.timeZone) : "--:--:--"}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-5 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-text-secondary">BTC</span>
          <span className="font-mono text-text-primary">
            {btcPrice !== null ? `$${btcPrice.toLocaleString()}` : "—"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-text-secondary">S&P 500</span>
          <span className="font-mono text-text-primary">
            {spxPrice !== null ? spxPrice.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"}
          </span>
        </div>
        <div className="flex items-center gap-1.5" title="Régime dominant global (Module 5)">
          <span>{regimeDot}</span>
          <span className="text-text-secondary">Régime</span>
        </div>
        <div className="relative flex items-center" title="Alertes non lues (Module 9)">
          <span className="text-lg">🔔</span>
          {unreadAlerts > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-bear px-1 text-[10px] font-semibold text-white">
              {unreadAlerts}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
