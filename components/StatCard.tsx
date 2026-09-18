export default function StatCard({
  label,
  value,
  tone = "neutral",
  big = false,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "bull" | "bear";
  big?: boolean;
}) {
  const toneClass = tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : "text-text-primary";
  return (
    <div className="rounded-card border border-border bg-card p-4">
      <div className="text-xs text-text-secondary">{label}</div>
      <div className={`mt-1 font-mono ${big ? "text-2xl" : "text-lg"} ${toneClass}`}>{value}</div>
    </div>
  );
}
