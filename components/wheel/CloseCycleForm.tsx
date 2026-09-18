"use client";

import { FormEvent, useState } from "react";
import { WHEEL_SCENARIOS, WHEEL_SCENARIO_LABELS, type WheelCycleDTO } from "@/lib/types";

const inputClass =
  "w-full rounded-button border border-border bg-bg px-3 py-1.5 text-sm text-text-primary outline-none focus:border-link";
const labelClass = "mb-1 block text-xs text-text-secondary";

export default function CloseCycleForm({
  cycle,
  onSubmit,
  onCancel,
}: {
  cycle: WheelCycleDTO;
  onSubmit: (values: { result: string; scenario: string; pnl: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [result, setResult] = useState("");
  const [scenario, setScenario] = useState<string>(WHEEL_SCENARIOS[0]);
  const [pnl, setPnl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ result, scenario, pnl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm text-text-secondary">
        Phase {cycle.phase} — strike {cycle.strike} — prime {cycle.premium}
      </p>

      <div>
        <label className={labelClass}>Scénario</label>
        <select className={inputClass} value={scenario} onChange={(e) => setScenario(e.target.value)}>
          {WHEEL_SCENARIOS.map((s) => (
            <option key={s} value={s}>
              {WHEEL_SCENARIO_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Résultat (prix BTC à la clôture, $)</label>
          <input type="number" step="any" className={inputClass} value={result} onChange={(e) => setResult(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>PnL du cycle ($)</label>
          <input type="number" step="any" className={inputClass} value={pnl} onChange={(e) => setPnl(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm text-bear">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-button border border-border px-4 py-1.5 text-sm text-text-secondary hover:text-text-primary">
          Annuler
        </button>
        <button type="submit" disabled={saving} className="rounded-button bg-bear px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60">
          {saving ? "Clôture..." : "Clôturer le cycle"}
        </button>
      </div>
    </form>
  );
}
