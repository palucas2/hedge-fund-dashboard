"use client";

import { FormEvent, useState } from "react";
import { STRATEGIES, TAGS, type TradeDTO } from "@/lib/types";

export type TradeFormValues = {
  asset: string;
  strategy: string;
  direction: string;
  entryDate: string;
  entryPrice: string;
  exitDate: string;
  exitPrice: string;
  sizingUsd: string;
  sizingPct: string;
  sl: string;
  tp1: string;
  tp2: string;
  thesis: string;
  lesson: string;
  tags: string;
};

function toFormValues(t?: Partial<TradeDTO>): TradeFormValues {
  return {
    asset: t?.asset ?? "",
    strategy: t?.strategy ?? STRATEGIES[0],
    direction: t?.direction ?? "long",
    entryDate: t?.entryDate ? t.entryDate.slice(0, 10) : "",
    entryPrice: t?.entryPrice?.toString() ?? "",
    exitDate: t?.exitDate ? t.exitDate.slice(0, 10) : "",
    exitPrice: t?.exitPrice?.toString() ?? "",
    sizingUsd: t?.sizingUsd?.toString() ?? "",
    sizingPct: t?.sizingPct?.toString() ?? "",
    sl: t?.sl?.toString() ?? "",
    tp1: t?.tp1?.toString() ?? "",
    tp2: t?.tp2?.toString() ?? "",
    thesis: t?.thesis ?? "",
    lesson: t?.lesson ?? "",
    tags: t?.tags ?? TAGS[0],
  };
}

const inputClass =
  "w-full rounded-button border border-border bg-bg px-3 py-1.5 text-sm text-text-primary outline-none focus:border-link";
const labelClass = "mb-1 block text-xs text-text-secondary";

export default function TradeForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Enregistrer",
}: {
  initial?: Partial<TradeDTO>;
  onSubmit: (values: TradeFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<TradeFormValues>(toFormValues(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof TradeFormValues>(key: K, v: TradeFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values.asset || !values.direction) {
      setError("Asset et direction sont requis.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Asset</label>
          <input className={inputClass} value={values.asset} onChange={(e) => set("asset", e.target.value)} placeholder="RTX, BTC…" />
        </div>
        <div>
          <label className={labelClass}>Direction</label>
          <select className={inputClass} value={values.direction} onChange={(e) => set("direction", e.target.value)}>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Stratégie</label>
          <select className={inputClass} value={values.strategy} onChange={(e) => set("strategy", e.target.value)}>
            {STRATEGIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Tag</label>
          <select className={inputClass} value={values.tags} onChange={(e) => set("tags", e.target.value)}>
            {TAGS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Date d'entrée</label>
          <input type="date" className={inputClass} value={values.entryDate} onChange={(e) => set("entryDate", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Prix d'entrée</label>
          <input type="number" step="any" className={inputClass} value={values.entryPrice} onChange={(e) => set("entryPrice", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Date de sortie</label>
          <input type="date" className={inputClass} value={values.exitDate} onChange={(e) => set("exitDate", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Prix de sortie</label>
          <input type="number" step="any" className={inputClass} value={values.exitPrice} onChange={(e) => set("exitPrice", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Sizing $</label>
          <input type="number" step="any" className={inputClass} value={values.sizingUsd} onChange={(e) => set("sizingUsd", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Sizing %</label>
          <input type="number" step="any" className={inputClass} value={values.sizingPct} onChange={(e) => set("sizingPct", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>SL</label>
          <input type="number" step="any" className={inputClass} value={values.sl} onChange={(e) => set("sl", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>TP1</label>
          <input type="number" step="any" className={inputClass} value={values.tp1} onChange={(e) => set("tp1", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>TP2</label>
          <input type="number" step="any" className={inputClass} value={values.tp2} onChange={(e) => set("tp2", e.target.value)} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Thèse d'entrée</label>
        <textarea className={inputClass} rows={2} value={values.thesis} onChange={(e) => set("thesis", e.target.value)} />
      </div>

      <div>
        <label className={labelClass}>Leçon apprise</label>
        <textarea className={inputClass} rows={2} value={values.lesson} onChange={(e) => set("lesson", e.target.value)} />
      </div>

      {error && <p className="text-sm text-bear">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-button border border-border px-4 py-1.5 text-sm text-text-secondary hover:text-text-primary">
          Annuler
        </button>
        <button type="submit" disabled={saving} className="rounded-button bg-link px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60">
          {saving ? "Enregistrement..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
