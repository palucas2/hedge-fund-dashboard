"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AntecedeEdgeDTO, AntecedeNodeDTO } from "@/lib/types";

type Overview = { peRatio: number | null; revenueGrowth: number | null; marketCap: number | null };
type NewsItem = { title: string; url: string; source: string; publishedAt: string };

const TYPE_LABELS: Record<string, string> = {
  company: "Company",
  country: "Country",
  alliance: "Alliance",
  resource: "Resource",
  program: "Program",
  etf: "ETF",
  bond: "Bond",
  currency: "Currency",
  crypto: "Crypto",
};

export default function EntityPanel({
  node,
  neighbors,
  edges,
  onClose,
}: {
  node: AntecedeNodeDTO;
  neighbors: AntecedeNodeDTO[];
  edges: AntecedeEdgeDTO[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewConfigured, setOverviewConfigured] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOverview(null);
    setAnalysis(null);
    setError(null);

    if (node.type === "company" && node.ticker) {
      fetch(`/api/antecede/fundamentals?ticker=${encodeURIComponent(node.ticker)}`)
        .then((r) => r.json())
        .then((d) => {
          setOverviewConfigured(d.configured);
          setOverview(d.overview);
        });
    }

    fetch(`/api/antecede/news?name=${encodeURIComponent(node.name)}`)
      .then((r) => r.json())
      .then(setNews);
  }, [node]);

  const relations = edges
    .filter((e) => e.sourceId === node.id || e.targetId === node.id)
    .map((e) => {
      const otherId = e.sourceId === node.id ? e.targetId : e.sourceId;
      const other = neighbors.find((n) => n.id === otherId);
      const outgoing = e.sourceId === node.id;
      return { edge: e, other, outgoing };
    });

  async function handleAnalyze() {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/antecede/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: node.id }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Erreur");
      setAnalysis((await res.json()).analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setAnalyzing(false);
    }
  }

  function handleStructureTrade() {
    router.push(`/journal?prefillAsset=${encodeURIComponent(node.ticker ?? node.name)}&prefillStrategy=Géopolitique`);
  }

  return (
    <div className="flex h-full w-[320px] shrink-0 flex-col gap-4 overflow-y-auto rounded-card border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-text-primary">
            {node.name} {node.chokepoint && <span title="Chokepoint non-bypassable">⛔</span>}
          </div>
          <div className="text-xs text-text-secondary">{TYPE_LABELS[node.type]}</div>
        </div>
        <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
          ✕
        </button>
      </div>

      {node.description && <p className="text-xs text-text-secondary">{node.description}</p>}

      {node.type === "company" && (
        <div>
          <div className="mb-1 text-xs font-medium text-text-primary">Fondamentaux</div>
          {overview ? (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-text-secondary">P/E</div>
                <div className="text-text-primary">{overview.peRatio ?? "—"}</div>
              </div>
              <div>
                <div className="text-text-secondary">Rev. growth</div>
                <div className="text-text-primary">{overview.revenueGrowth !== null ? `${overview.revenueGrowth.toFixed(1)}%` : "—"}</div>
              </div>
              <div>
                <div className="text-text-secondary">Market cap</div>
                <div className="text-text-primary">{overview.marketCap ? `$${(overview.marketCap / 1e9).toFixed(1)}B` : "—"}</div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-text-secondary">
              {overviewConfigured ? "Chargement…" : "Configure ALPHA_VANTAGE_KEY pour les fondamentaux."}
            </p>
          )}
        </div>
      )}

      <div>
        <div className="mb-1 text-xs font-medium text-text-primary">Relations ({relations.length})</div>
        <div className="space-y-1.5">
          {relations.map(({ edge, other, outgoing }) => (
            <div key={edge.id} className="text-xs text-text-secondary">
              {outgoing ? "→" : "←"} {other?.name ?? "?"}{" "}
              <span className="text-text-secondary/70">
                ({edge.edgeType}{edge.weightFinancialPct ? `, ${edge.weightFinancialPct}%` : ""})
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 text-xs font-medium text-text-primary">Dernières news</div>
        {news.length === 0 ? (
          <p className="text-xs text-text-secondary">Aucune news récente trouvée.</p>
        ) : (
          <div className="space-y-1.5">
            {news.map((n) => (
              <a key={n.url} href={n.url} target="_blank" rel="noopener noreferrer" className="block text-xs text-link hover:underline">
                {n.title}
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="mt-auto space-y-2">
        {error && <p className="text-xs text-bear">{error}</p>}
        {analysis && <div className="rounded-button border border-border bg-bg p-2 text-xs text-text-primary">{analysis}</div>}
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="w-full rounded-button bg-link px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {analyzing ? "Analyse..." : "Analyser avec Claude"}
        </button>
        <button
          onClick={handleStructureTrade}
          className="w-full rounded-button border border-border px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
        >
          Structurer le trade →
        </button>
      </div>
    </div>
  );
}
