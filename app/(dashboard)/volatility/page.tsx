"use client";

import { useEffect, useMemo, useState } from "react";
import AlertCard from "@/components/volatility/AlertCard";
import CentralBankCountdown from "@/components/volatility/CentralBankCountdown";
import { getUpcomingMeetings } from "@/lib/central-bank-calendar";
import type { AlertDTO } from "@/lib/types";
import { ALERT_TYPES, ALERT_TYPE_LABELS } from "@/lib/types";

const REFRESH_MS = 2 * 60 * 1000;

export default function VolatilityPage() {
  const [alerts, setAlerts] = useState<AlertDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(ALERT_TYPES));
  const [activeSeverities, setActiveSeverities] = useState<Set<string>>(new Set(["red", "orange", "yellow"]));

  async function load() {
    const res = await fetch("/api/alerts");
    if (res.ok) setAlerts(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  function toggleType(t: string) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function toggleSeverity(s: string) {
    setActiveSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  const filteredAlerts = alerts.filter(
    (a) => activeTypes.has(a.type) && (!a.severity || activeSeverities.has(a.severity))
  );

  const upcomingMeetings = useMemo(() => getUpcomingMeetings(6), []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Module 9 — Volatility & Event Tracker</h1>
        <p className="text-sm text-text-secondary">
          Les 5 catégories tournent sur données réelles : géopolitique + banques centrales + volume + mouvements de prix
          (Yahoo Finance, sans clé) et Earnings Surprises (Alpha Vantage).
        </p>
      </div>

      <CentralBankCountdown meetings={upcomingMeetings} />

      <div className="flex flex-wrap items-center gap-2">
        {ALERT_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => toggleType(t)}
            className={`rounded-button border px-2.5 py-1 text-xs ${
              activeTypes.has(t) ? "border-link text-text-primary" : "border-border text-text-secondary opacity-50"
            }`}
          >
            {ALERT_TYPE_LABELS[t]}
          </button>
        ))}
        <span className="mx-2 text-text-secondary">|</span>
        {[
          { key: "red", label: "🔴 Critique" },
          { key: "orange", label: "🟠 Important" },
          { key: "yellow", label: "🟡 Surveillance" },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => toggleSeverity(s.key)}
            className={`rounded-button border px-2.5 py-1 text-xs ${
              activeSeverities.has(s.key) ? "border-link text-text-primary" : "border-border text-text-secondary opacity-50"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : filteredAlerts.length === 0 ? (
        <p className="text-sm text-text-secondary">Aucune alerte pour l'instant.</p>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((a) => (
            <AlertCard key={a.id} alert={a} onOutcomeChange={load} />
          ))}
        </div>
      )}
    </div>
  );
}
