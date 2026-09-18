"use client";

import { FormEvent, useState } from "react";
import type { TradeDTO } from "@/lib/types";

const inputClass =
  "w-full rounded-button border border-border bg-bg px-3 py-1.5 text-sm text-text-primary outline-none focus:border-link";
const labelClass = "mb-1 block text-xs text-text-secondary";

export default function CloseTradeForm({
  trade,
  onSubmit,
  onCancel,
}: {
  trade: TradeDTO;
  onSubmit: (values: { exitDate: string; exitPrice: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [exitDate, setExitDate] = useState(new Date().toISOString().slice(0, 10));
  const [exitPrice, setExitPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!exitPrice) {
      setError("Le prix de sortie est requis.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ exitDate, exitPrice });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm text-text-secondary">
        {trade.asset} — entrée {trade.entryPrice ?? "—"} le {trade.entryDate?.slice(0, 10) ?? "—"}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Date de sortie</label>
          <input type="date" className={inputClass} value={exitDate} onChange={(e) => setExitDate(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Prix de sortie</label>
          <input type="number" step="any" className={inputClass} value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-bear">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-button border border-border px-4 py-1.5 text-sm text-text-secondary hover:text-text-primary">
          Annuler
        </button>
        <button type="submit" disabled={saving} className="rounded-button bg-bear px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60">
          {saving ? "Clôture..." : "Fermer le trade"}
        </button>
      </div>
    </form>
  );
}
