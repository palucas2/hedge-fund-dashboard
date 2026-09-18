"use client";

import { CATEGORY_COLORS, CATEGORY_LABELS, type NewsCategory } from "@/lib/geo";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as NewsCategory[];
const TIMEFRAMES = [
  { value: 6, label: "6h" },
  { value: 24, label: "24h" },
  { value: 168, label: "7j" },
];

export default function NewsFilter({
  activeCategories,
  onToggleCategory,
  timeframeHours,
  onTimeframeChange,
}: {
  activeCategories: Set<NewsCategory>;
  onToggleCategory: (c: NewsCategory) => void;
  timeframeHours: number;
  onTimeframeChange: (h: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {CATEGORIES.map((c) => {
        const active = activeCategories.has(c);
        return (
          <button
            key={c}
            onClick={() => onToggleCategory(c)}
            className="flex items-center gap-1.5 rounded-button border px-2.5 py-1 text-xs transition-opacity"
            style={{
              borderColor: CATEGORY_COLORS[c],
              opacity: active ? 1 : 0.35,
              color: active ? "#e6e7ec" : "#9396a1",
            }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLORS[c] }} />
            {CATEGORY_LABELS[c]}
          </button>
        );
      })}

      <div className="ml-auto flex gap-1 rounded-button border border-border bg-card p-0.5">
        {TIMEFRAMES.map((t) => (
          <button
            key={t.value}
            onClick={() => onTimeframeChange(t.value)}
            className={`rounded px-2.5 py-1 text-xs ${
              timeframeHours === t.value ? "bg-link text-white" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
