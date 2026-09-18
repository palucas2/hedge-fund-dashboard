"use client";

import { useEffect, useState } from "react";
import type { MarketRecapDTO } from "@/lib/types";
import RecapContent from "@/components/market-recap/RecapContent";
import { exportRecapPdf } from "@/lib/pdf";

export default function MarketRecapPage() {
  const [recaps, setRecaps] = useState<MarketRecapDTO[]>([]);
  const [configured, setConfigured] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shared, setShared] = useState(false);

  async function load() {
    const res = await fetch("/api/market-recap");
    if (res.ok) {
      const data = await res.json();
      setConfigured(data.configured);
      setRecaps(data.recaps);
      if (data.recaps.length > 0 && selectedId === null) setSelectedId(data.recaps[0].id);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/market-recap", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Erreur");
      const recap: MarketRecapDTO = await res.json();
      setRecaps((prev) => [recap, ...prev]);
      setSelectedId(recap.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setGenerating(false);
    }
  }

  async function handlePin(id: number, pinned: boolean) {
    const res = await fetch(`/api/market-recap/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    });
    if (res.ok) await load();
  }

  async function handleShare(id: number) {
    const res = await fetch(`/api/market-recap/${id}/share`, { method: "POST" });
    if (res.ok) {
      setShared(true);
      setTimeout(() => setShared(false), 3000);
    }
  }

  const selected = recaps.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Module 6 — Market Recap</h1>
          <p className="text-sm text-text-secondary">Brief quotidien généré via l'API Anthropic (Claude + web search).</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating || !configured}
          className="rounded-button bg-link px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          title={!configured ? "Configure ANTHROPIC_API_KEY dans .env.local" : undefined}
        >
          {generating ? "Génération... (~30-60s)" : "Generate MC"}
        </button>
      </div>

      {!configured && (
        <p className="text-xs text-text-secondary">
          Génération désactivée — configure <code className="text-link">ANTHROPIC_API_KEY</code> dans <code>.env.local</code> pour l'activer.
        </p>
      )}
      {error && <p className="text-sm text-bear">{error}</p>}
      {shared && <p className="text-sm text-bull">Partagé — visible dans les alertes (Module 9, à venir).</p>}

      {recaps.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(Number(e.target.value))}
            className="rounded-button border border-border bg-card px-2 py-1 text-sm text-text-primary outline-none focus:border-link"
          >
            {recaps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.date.slice(0, 10)} {r.pinned ? "★" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {selected ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => exportRecapPdf(selected)}
              className="rounded-button border border-border px-3 py-1 text-xs text-text-secondary hover:text-text-primary"
            >
              Export PDF
            </button>
            <button
              onClick={() => handleShare(selected.id)}
              className="rounded-button border border-border px-3 py-1 text-xs text-text-secondary hover:text-text-primary"
            >
              Partager
            </button>
            <button
              onClick={() => handlePin(selected.id, !selected.pinned)}
              className={`rounded-button border px-3 py-1 text-xs ${selected.pinned ? "border-lateral text-lateral" : "border-border text-text-secondary hover:text-text-primary"}`}
            >
              {selected.pinned ? "★ Épinglé comme Alpha" : "Pin comme Alpha"}
            </button>
            <span className="ml-auto self-center text-xs text-text-secondary">
              Généré le {new Date(selected.generatedAt).toLocaleString("fr-FR")} — {selected.modelUsed ?? "—"}
            </span>
          </div>

          <RecapContent content={selected.content} />
        </div>
      ) : (
        <p className="text-sm text-text-secondary">Aucun brief archivé pour l'instant.</p>
      )}
    </div>
  );
}
