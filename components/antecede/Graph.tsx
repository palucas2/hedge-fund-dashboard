"use client";

import { useEffect, useRef } from "react";
import type { AntecedeEdgeDTO, AntecedeNodeDTO } from "@/lib/types";

const NODE_SHAPES: Record<string, string> = {
  company: "rectangle",
  country: "ellipse",
  alliance: "hexagon",
  resource: "diamond",
  program: "star",
  etf: "round-rectangle",
  bond: "triangle",
  currency: "tag",
  crypto: "octagon",
};
const NODE_COLORS: Record<string, string> = {
  company: "#5a8de8",
  country: "#26A69A",
  alliance: "#9c6ade",
  resource: "#FFA726",
  program: "#9396a1",
  etf: "#4fc3f7",
  bond: "#c9a66b",
  currency: "#26c6da",
  crypto: "#f06292",
};
const EDGE_COLORS: Record<string, string> = {
  conflict: "#EF5350",
  trade: "#26A69A",
  dependency: "#FFA726",
  alliance: "#5a8de8",
};

export default function Graph({
  nodes,
  edges,
  activeCategories,
  onSelectNode,
  centerOn,
}: {
  nodes: AntecedeNodeDTO[];
  edges: AntecedeEdgeDTO[];
  activeCategories: Set<string>;
  onSelectNode: (nodeId: string) => void;
  centerOn: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cyRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    import("cytoscape").then((mod) => {
      if (cancelled || !containerRef.current) return;
      const cytoscape = mod.default;

      const cy = cytoscape({
        container: containerRef.current,
        style: [
          {
            selector: "node",
            style: {
              label: "data(label)",
              "font-size": 10,
              color: "#e6e7ec",
              "text-valign": "bottom",
              "text-margin-y": 6,
              width: 32,
              height: 32,
              "background-color": "data(color)",
              shape: "data(shape)" as never,
              "border-width": "data(borderWidth)" as never,
              "border-color": "#EF5350",
            },
          },
          {
            selector: "edge",
            style: {
              width: "data(width)" as never,
              "line-color": "data(color)",
              "target-arrow-color": "data(color)",
              "target-arrow-shape": "triangle",
              "curve-style": "bezier",
              opacity: 0.8,
            },
          },
        ],
        layout: { name: "cose", animate: false },
        wheelSensitivity: 0.2,
      });

      cy.on("tap", "node", (evt) => {
        onSelectNode(evt.target.id());
      });

      cyRef.current = cy;
    });

    return () => {
      cancelled = true;
      cyRef.current?.destroy();
      cyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    const filteredEdges = edges.filter((e) => activeCategories.has(e.edgeCategory));
    const visibleNodeIds = new Set<string>();
    filteredEdges.forEach((e) => {
      visibleNodeIds.add(e.sourceId);
      visibleNodeIds.add(e.targetId);
    });
    nodes.forEach((n) => visibleNodeIds.add(n.id)); // les nœuds isolés restent visibles

    cy.elements().remove();
    cy.add([
      ...nodes.map((n) => ({
        data: {
          id: n.id,
          label: n.chokepoint ? `${n.name} ⛔` : n.name,
          color: NODE_COLORS[n.type] ?? "#9396a1",
          shape: NODE_SHAPES[n.type] ?? "ellipse",
          borderWidth: n.chokepoint ? 3 : 0,
        },
      })),
      ...filteredEdges.map((e) => ({
        data: {
          id: `e${e.id}`,
          source: e.sourceId,
          target: e.targetId,
          color: EDGE_COLORS[e.edgeCategory] ?? "#9396a1",
          width: Math.max(1, (e.weightFinancialPct ?? 10) / 12),
        },
      })),
    ]);
    cy.layout({ name: "cose", animate: false }).run();
  }, [nodes, edges, activeCategories]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !centerOn) return;
    const el = cy.getElementById(centerOn);
    if (el && el.length > 0) {
      cy.animate({ center: { eles: el }, zoom: 1.5 }, { duration: 400 });
    }
  }, [centerOn]);

  return <div ref={containerRef} className="h-full w-full rounded-card border border-border bg-card" />;
}
