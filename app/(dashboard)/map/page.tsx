"use client";

import { useEffect, useMemo, useState } from "react";
import WorldMap from "@/components/map/WorldMap";
import NewsFilter from "@/components/map/NewsFilter";
import RegionCounter from "@/components/map/RegionCounter";
import type { NewsPinData } from "@/lib/news";
import type { NewsCategory } from "@/lib/geo";

const REFRESH_MS = 2 * 60 * 1000; // fraîcheur cible < 3 min (flux RSS investing.com, voir lib/rss.ts)

export default function MapPage() {
  const [pins, setPins] = useState<NewsPinData[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [newsApiConfigured, setNewsApiConfigured] = useState(false);
  const [timeframeHours, setTimeframeHours] = useState(24);
  const [activeCategories, setActiveCategories] = useState<Set<NewsCategory>>(
    new Set(["geopolitical", "macro", "corporate", "commodity"])
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch(`/api/news?hours=${timeframeHours}`);
      if (cancelled || !res.ok) return;
      const data = await res.json();
      setNewsApiConfigured(data.newsApiConfigured);
      setPins(data.pins);
      setLastUpdated(new Date());
    }

    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [timeframeHours]);

  function toggleCategory(c: NewsCategory) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  const filteredPins = useMemo(() => pins.filter((p) => activeCategories.has(p.category)), [pins, activeCategories]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-3 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Module 1 — Map Monde</h1>
        <span className="text-xs text-text-secondary">
          {lastUpdated && `Actualisé à ${lastUpdated.toLocaleTimeString("fr-FR")} (flux RSS, refresh 2 min)`}
          {!newsApiConfigured && " — NEWS_API_KEY absent : couverture RSS uniquement"}
        </span>
      </div>

      <NewsFilter
        activeCategories={activeCategories}
        onToggleCategory={toggleCategory}
        timeframeHours={timeframeHours}
        onTimeframeChange={setTimeframeHours}
      />

      <div className="relative flex-1">
        <WorldMap pins={filteredPins} />
        <RegionCounter pins={filteredPins} />
      </div>
    </div>
  );
}
