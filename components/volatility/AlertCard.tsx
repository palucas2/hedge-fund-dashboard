"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AlertDTO } from "@/lib/types";
import { ALERT_OUTCOME_LABELS, ALERT_OUTCOMES, ALERT_TYPE_LABELS } from "@/lib/types";

const SEVERITY_DOTS: Record<string, string> = { red: "🔴", orange: "🟠", yellow: "🟡" };

export default function AlertCard({ alert, onOutcomeChange }: { alert: AlertDTO; onOutcomeChange: () => void }) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeLabel = ALERT_TYPE_LABELS[alert.type as keyof typeof ALERT_TYPE_LABELS] ?? alert.type;

  async function handleAnalyze() {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(`/api/alerts/${alert.id}/analyze`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Erreur");
      setAnalysis((await res.json()).analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleOutcome(outcome: string) {
    await fetch(`/api/alerts/${alert.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome }),
    });
    onOutcomeChange();
  }

  return (
    <div className="rounded-card border border-border bg-card p-4">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-sm font-medium text-text-primary">
          {SEVERITY_DOTS[alert.severity ?? ""] ?? "⚪"} {typeLabel.toUpperCase()}
          {alert.asset && ` — ${alert.asset}`}
        </div>
        <span className="text-xs text-text-secondary">{new Date(alert.createdAt).toLocaleString("fr-FR")}</span>
      </div>

      <p className="mb-2 whitespace-pre-line text-sm text-text-secondary">{alert.description}</p>

      <div className="mb-3 flex items-center gap-3 text-xs text-text-secondary">
        {alert.relevanceScore !== null && <span>Pertinence : {"⭐".repeat(alert.relevanceScore)}</span>}
        <span className={`rounded px-1.5 py-0.5 ${alert.outcome === "pending" ? "bg-lateral/20 text-lateral" : "bg-border text-text-secondary"}`}>
          {ALERT_OUTCOME_LABELS[alert.outcome]}
        </span>
      </div>

      {error && <p className="mb-2 text-xs text-bear">{error}</p>}
      {analysis && <div className="mb-3 rounded-button border border-border bg-bg p-2 text-xs text-text-primary">{analysis}</div>}

      <div className="flex flex-wrap gap-2 text-xs">
        <button
          onClick={() => router.push(`/journal?prefillAsset=${encodeURIComponent(alert.asset ?? "")}&prefillStrategy=Géopolitique`)}
          className="rounded-button border border-border px-2.5 py-1 text-text-secondary hover:text-text-primary"
        >
          Structurer le trade →
        </button>
        <button
          onClick={() => router.push(`/antecede?q=${encodeURIComponent(alert.asset ?? "")}`)}
          className="rounded-button border border-border px-2.5 py-1 text-text-secondary hover:text-text-primary"
        >
          Voir dans le graphe →
        </button>
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="rounded-button border border-border px-2.5 py-1 text-text-secondary hover:text-text-primary disabled:opacity-50"
        >
          {analyzing ? "Analyse..." : "Analyser avec Claude →"}
        </button>

        <div className="ml-auto flex gap-1">
          {ALERT_OUTCOMES.filter((o) => o !== "pending").map((o) => (
            <button
              key={o}
              onClick={() => handleOutcome(o)}
              className={`rounded-button border px-2 py-1 ${
                alert.outcome === o ? "border-link text-link" : "border-border text-text-secondary hover:text-text-primary"
              }`}
            >
              {ALERT_OUTCOME_LABELS[o]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
