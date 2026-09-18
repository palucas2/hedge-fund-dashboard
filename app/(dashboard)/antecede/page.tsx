"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Graph from "@/components/antecede/Graph";
import GraphControls from "@/components/antecede/GraphControls";
import EntityPanel from "@/components/antecede/EntityPanel";
import type { AntecedeEdgeDTO, AntecedeNodeDTO } from "@/lib/types";

export default function AntecedePage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-text-secondary">Chargement…</p>}>
      <AntecedePageContent />
    </Suspense>
  );
}

function AntecedePageContent() {
  const searchParams = useSearchParams();
  const [nodes, setNodes] = useState<AntecedeNodeDTO[]>([]);
  const [edges, setEdges] = useState<AntecedeEdgeDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set(["conflict", "trade", "dependency", "alliance"])
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [centerOn, setCenterOn] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<AntecedeNodeDTO[]>([]);

  useEffect(() => {
    fetch("/api/antecede/graph")
      .then((r) => r.json())
      .then((data) => {
        setNodes(data.nodes);
        setEdges(data.edges);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    // "Voir dans le graphe" depuis le Module 9 (Volatility Tracker)
    const q = searchParams.get("q");
    if (!q || nodes.length === 0) return;
    fetch(`/api/antecede/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((results: AntecedeNodeDTO[]) => {
        if (results.length > 0) {
          setSelectedNodeId(results[0].id);
          setCenterOn(results[0].id);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length]);

  function toggleCategory(c: string) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  function handleSelectFromSearch(node: AntecedeNodeDTO) {
    setSelectedNodeId(node.id);
    setCenterOn(node.id);
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-3 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Module 7 — Antecede Graph</h1>
          <p className="text-sm text-text-secondary">
            Dataset d'exemple (19 entités / {edges.length} relations) — à remplacer par le vrai dataset de production.
          </p>
        </div>
      </div>

      <div className="relative">
        <GraphControls activeCategories={activeCategories} onToggleCategory={toggleCategory} onSearch={setSearchResults} />
        {searchResults.length > 0 && (
          <div className="absolute z-10 mt-1 w-56 rounded-card border border-border bg-card p-1">
            {searchResults.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  handleSelectFromSearch(n);
                  setSearchResults([]);
                }}
                className="block w-full rounded px-2 py-1 text-left text-xs text-text-secondary hover:bg-bg hover:text-text-primary"
              >
                {n.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-text-secondary">Chargement du graphe…</p>
      ) : (
        <div className="flex flex-1 gap-4 overflow-hidden">
          <Graph
            nodes={nodes}
            edges={edges}
            activeCategories={activeCategories}
            onSelectNode={setSelectedNodeId}
            centerOn={centerOn}
          />
          {selectedNode && (
            <EntityPanel node={selectedNode} neighbors={nodes} edges={edges} onClose={() => setSelectedNodeId(null)} />
          )}
        </div>
      )}
    </div>
  );
}
