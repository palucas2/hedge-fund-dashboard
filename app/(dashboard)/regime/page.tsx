"use client";

import { useEffect, useState } from "react";
import RegimeGauge from "@/components/regime/RegimeGauge";
import RegimeTimeline from "@/components/regime/RegimeTimeline";
import type { RegimeLabel, RegimeResult } from "@/lib/regime";
import { SIZING_RECOMMENDATIONS } from "@/lib/regime";

const REFRESH_MS = 60 * 60 * 1000; // spec : régimes daily, refresh horaire

const DOTS: Record<RegimeLabel, string> = { bull: "🟢", bear: "🔴", lateral: "🟡" };

export default function RegimePage() {
  const [assets, setAssets] = useState<RegimeResult[]>([]);
  const [globalRegime, setGlobalRegime] = useState<RegimeLabel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/regime");
        if (!res.ok) throw new Error("Erreur de calcul des régimes");
        const data = await res.json();
        if (cancelled) return;
        setAssets(data.assets);
        setGlobalRegime(data.globalRegime);
      } catch {
        if (!cancelled) setError("Impossible de calculer les régimes pour le moment.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Module 5 — Regime Detector</h1>
        <p className="text-sm text-text-secondary">
          Modèle Markov (HMM gaussien 3 états, Baum-Welch) sur les 300 dernières bougies daily de chaque asset (Yahoo Finance).
        </p>
      </div>

      {loading && <p className="text-sm text-text-secondary">Calcul des régimes en cours…</p>}
      {error && <p className="text-sm text-bear">{error}</p>}

      {globalRegime && (
        <div className="rounded-card border border-border bg-card p-4">
          <div className="mb-1 text-sm font-medium text-text-primary">
            Régime dominant global {DOTS[globalRegime]}
          </div>
          <div className="text-sm text-text-secondary">{SIZING_RECOMMENDATIONS[globalRegime]}</div>
        </div>
      )}

      {assets.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {assets.map((a) => (
              <RegimeGauge key={a.assetId} result={a} />
            ))}
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-text-primary">Timeline des changements de régime (30 derniers jours)</div>
            <div className="space-y-2">
              {assets.map((a) => (
                <RegimeTimeline key={a.assetId} result={a} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
