"use client";

import { useState } from "react";
import type { AntecedeNodeDTO } from "@/lib/types";

const CATEGORIES = [
  { key: "conflict", label: "Conflict / restriction", color: "#EF5350" },
  { key: "trade", label: "Trade / operational", color: "#26A69A" },
  { key: "dependency", label: "Dependency", color: "#FFA726" },
  { key: "alliance", label: "Alliance / ownership", color: "#5a8de8" },
];

export default function GraphControls({
  activeCategories,
  onToggleCategory,
  onSearch,
}: {
  activeCategories: Set<string>;
  onToggleCategory: (c: string) => void;
  onSearch: (results: AntecedeNodeDTO[]) => void;
}) {
  const [query, setQuery] = useState("");

  async function handleSearch(value: string) {
    setQuery(value);
    if (value.length < 2) {
      onSearch([]);
      return;
    }
    const res = await fetch(`/api/antecede/search?q=${encodeURIComponent(value)}`);
    if (res.ok) onSearch(await res.json());
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Rechercher une entité…"
        className="w-56 rounded-button border border-border bg-card px-3 py-1.5 text-sm text-text-primary outline-none focus:border-link"
      />

      {CATEGORIES.map((c) => {
        const active = activeCategories.has(c.key);
        return (
          <button
            key={c.key}
            onClick={() => onToggleCategory(c.key)}
            className="flex items-center gap-1.5 rounded-button border px-2.5 py-1 text-xs"
            style={{ borderColor: c.color, opacity: active ? 1 : 0.35, color: active ? "#e6e7ec" : "#9396a1" }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
