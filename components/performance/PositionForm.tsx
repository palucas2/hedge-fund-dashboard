"use client";

import { FormEvent, useState } from "react";
import type { PositionDTO } from "@/lib/types";

const DEFAULT_ENTRY_DATE = "2026-04-03"; // spec 4 — Module 2 Section A

export type PositionFormValues = {
  ticker: string;
  entryPrice: string;
  entryDate: string;
  quantity: string;
  sl: string;
  tp1: string;
  tp2: string;
};

function toFormValues(p?: Partial<PositionDTO>): PositionFormValues {
  return {
    ticker: p?.ticker ?? "",
    entryPrice: p?.entryPrice?.toString() ?? "",
    entryDate: p?.entryDate ? p.entryDate.slice(0, 10) : DEFAULT_ENTRY_DATE,
    quantity: p?.quantity?.toString() ?? "",
    sl: p?.sl?.toString() ?? "",
    tp1: p?.tp1?.toString() ?? "",
    tp2: p?.tp2?.toString() ?? "",
  };
}

const inputClass =
  "w-full rounded-button border border-border bg-bg px-3 py-1.5 text-sm text-text-primary outline-none focus:border-link";
const labelClass = "mb-1 block text-xs text-text-secondary";

export default function PositionForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<PositionDTO>;
  onSubmit: (values: PositionFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<PositionFormValues>(toFormValues(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof PositionFormValues>(key: K, v: PositionFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values.ticker || !values.entryPrice || !values.quantity) {
      setError("Ticker, prix d'entrée et quantité sont requis.");
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
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className={labelClass}>Ticker</label>
        <input className={inputClass} value={values.ticker} onChange={(e) => set("ticker", e.target.value.toUpperCase())} placeholder="EWZ" />
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
      <div>
        <label className={labelClass}>Quantité</label>
        <input type="number" step="any" className={inputClass} value={values.quantity} onChange={(e) => set("quantity", e.target.value)} />
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

      {error && <p className="text-sm text-bear">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-button border border-border px-4 py-1.5 text-sm text-text-secondary hover:text-text-primary">
          Annuler
        </button>
        <button type="submit" disabled={saving} className="rounded-button bg-link px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60">
          {saving ? "Enregistrement..." : "Ajouter"}
        </button>
      </div>
    </form>
  );
}
