import type { RegimeResult } from "@/lib/regime";

const COLORS = { bull: "#26A69A", bear: "#EF5350", lateral: "#FFA726" } as const;

export default function RegimeTimeline({ result }: { result: RegimeResult }) {
  return (
    <div className="rounded-card border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-text-primary">{result.label}</span>
        <span className="text-text-secondary">{result.timeline.length}j</span>
      </div>
      <div className="flex h-4 w-full overflow-hidden rounded">
        {result.timeline.map((t) => (
          <div key={t.date} title={`${t.date} — ${t.regime}`} className="h-full flex-1" style={{ background: COLORS[t.regime] }} />
        ))}
      </div>
    </div>
  );
}
