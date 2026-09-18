import type { WheelCycleDTO } from "@/lib/types";
import StatCard from "@/components/StatCard";

function fmtUsd(v: number | null) {
  if (v === null) return "—";
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function CurrentCycleCard({
  cycle,
  btcPrice,
  totalPremiumsToDate,
  canWrite,
  onClose,
  onNew,
}: {
  cycle: WheelCycleDTO | null;
  btcPrice: number | null;
  totalPremiumsToDate: number;
  canWrite: boolean;
  onClose: () => void;
  onNew: () => void;
}) {
  if (!cycle) {
    return (
      <div className="rounded-card border border-border bg-card p-6 text-center">
        <p className="text-sm text-text-secondary">Pas de cycle en cours.</p>
        {canWrite && (
          <button onClick={onNew} className="mt-3 rounded-button bg-link px-4 py-1.5 text-sm font-medium text-white">
            + Nouveau cycle
          </button>
        )}
      </div>
    );
  }

  const strike = cycle.strike ?? 0;
  const distanceUsd = btcPrice !== null ? btcPrice - strike : null;
  const distancePct = btcPrice !== null && strike !== 0 ? (distanceUsd! / strike) * 100 : null;

  const slDistancePct =
    btcPrice !== null && cycle.sl ? ((btcPrice - cycle.sl) / cycle.sl) * 100 : null;
  const slAlert = slDistancePct !== null && Math.abs(slDistancePct) <= 2;

  const breakeven = strike - totalPremiumsToDate;

  // jauge : position du prix BTC entre SL et strike (0 = au SL, 100 = au strike ou au-delà)
  const gaugePct =
    btcPrice !== null && cycle.sl && strike !== cycle.sl
      ? Math.max(0, Math.min(100, ((btcPrice - cycle.sl) / (strike - cycle.sl)) * 100))
      : null;

  return (
    <div className="rounded-card border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-text-primary">
            Phase {cycle.phase} — {cycle.phase === 1 ? "Put vendu" : "Call vendu (BTC détenu)"}
          </span>
          {slAlert && <span className="ml-2 rounded bg-bear/20 px-2 py-0.5 text-xs text-bear">🔴 BTC à moins de 2% du SL</span>}
        </div>
        {canWrite && (
          <button onClick={onClose} className="rounded-button border border-border px-3 py-1 text-xs text-text-secondary hover:text-text-primary">
            Clôturer le cycle
          </button>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Strike" value={fmtUsd(strike)} />
        <StatCard label="Prime encaissée" value={fmtUsd(cycle.premium)} tone="bull" />
        <StatCard label="Expiration" value={cycle.expiry?.slice(0, 10) ?? "—"} />
        <StatCard label="Stop-loss" value={fmtUsd(cycle.sl)} tone="bear" />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatCard
          label="BTC live vs strike"
          value={distancePct !== null ? `${distancePct >= 0 ? "+" : ""}${distancePct.toFixed(1)}% (${distanceUsd! >= 0 ? "+" : ""}$${Math.abs(distanceUsd!).toLocaleString(undefined, { maximumFractionDigits: 0 })})` : "—"}
          tone={distancePct === null ? "neutral" : distancePct >= 0 ? "bull" : "bear"}
        />
        <StatCard label="Prix de revient effectif" value={fmtUsd(breakeven)} />
      </div>

      {gaugePct !== null && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-text-secondary">
            <span>SL {fmtUsd(cycle.sl)}</span>
            <span>Strike {fmtUsd(strike)}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-bg">
            <div
              className={`h-2 rounded-full ${gaugePct <= 15 ? "bg-bear" : gaugePct <= 40 ? "bg-lateral" : "bg-bull"}`}
              style={{ width: `${gaugePct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
