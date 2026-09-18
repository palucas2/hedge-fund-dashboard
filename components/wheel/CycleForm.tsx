"use client";

import { FormEvent, useState } from "react";

const inputClass =
  "w-full rounded-button border border-border bg-bg px-3 py-1.5 text-sm text-text-primary outline-none focus:border-link";
const labelClass = "mb-1 block text-xs text-text-secondary";

export type CycleFormValues = {
  phase: string;
  strike: string;
  premium: string;
  expiry: string;
  sl: string;
};

export default function CycleForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (values: CycleFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<CycleFormValues>({ phase: "1", strike: "", premium: "", expiry: "", sl: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof CycleFormValues>(key: K, v: CycleFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values.strike) {
      setError("Le strike est requis.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className={labelClass}>Phase</label>
        <select className={inputClass} value={values.phase} onChange={(e) => set("phase", e.target.value)}>
          <option value="1">Phase 1 — Put vendu</option>
          <option value="2">Phase 2 — Call vendu (BTC détenu)</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Strike ($)</label>
          <input type="number" step="any" className={inputClass} value={values.strike} onChange={(e) => set("strike", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Prime encaissée ($)</label>
          <input type="number" step="any" className={inputClass} value={values.premium} onChange={(e) => set("premium", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Date d'expiration</label>
          <input type="date" className={inputClass} value={values.expiry} onChange={(e) => set("expiry", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Stop-loss ($)</label>
          <input type="number" step="any" className={inputClass} value={values.sl} onChange={(e) => set("sl", e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm text-bear">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-button border border-border px-4 py-1.5 text-sm text-text-secondary hover:text-text-primary">
          Annuler
        </button>
        <button type="submit" disabled={saving} className="rounded-button bg-link px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60">
          {saving ? "Enregistrement..." : "Créer le cycle"}
        </button>
      </div>
    </form>
  );
}
