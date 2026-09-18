import type { NewsPinData } from "@/lib/news";

export default function RegionCounter({ pins }: { pins: NewsPinData[] }) {
  const counts = new Map<string, number>();
  for (const p of pins) counts.set(p.region, (counts.get(p.region) ?? 0) + 1);

  if (counts.size === 0) return null;

  return (
    <div className="absolute bottom-4 right-4 z-10 rounded-card border border-border bg-card/90 p-3 text-xs backdrop-blur">
      <div className="mb-1.5 font-medium text-text-primary">News actives par région</div>
      <div className="space-y-1">
        {Array.from(counts.entries()).map(([region, count]) => (
          <div key={region} className="flex items-center justify-between gap-4 text-text-secondary">
            <span>{region}</span>
            <span className="font-mono text-text-primary">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
