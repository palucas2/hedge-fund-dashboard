"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import type { TradeDTO } from "@/lib/types";
import Modal from "@/components/Modal";
import TradeForm, { type TradeFormValues } from "@/components/journal/TradeForm";
import TradesTable from "@/components/journal/TradesTable";
import JournalAnalytics from "@/components/journal/JournalAnalytics";

function toPayload(values: TradeFormValues) {
  return {
    asset: values.asset,
    strategy: values.strategy,
    direction: values.direction,
    entryDate: values.entryDate || undefined,
    entryPrice: values.entryPrice,
    exitDate: values.exitDate || undefined,
    exitPrice: values.exitPrice,
    sizingUsd: values.sizingUsd,
    sizingPct: values.sizingPct,
    sl: values.sl,
    tp1: values.tp1,
    tp2: values.tp2,
    thesis: values.thesis,
    lesson: values.lesson,
    tags: values.tags,
  };
}

export default function JournalPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-text-secondary">Chargement…</p>}>
      <JournalPageContent />
    </Suspense>
  );
}

function JournalPageContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [trades, setTrades] = useState<TradeDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TradeDTO | null>(null);
  const [prefill, setPrefill] = useState<Partial<TradeDTO> | undefined>(undefined);

  async function loadTrades() {
    const res = await fetch("/api/trades");
    if (res.ok) setTrades(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    loadTrades();
  }, []);

  useEffect(() => {
    // "Structurer le trade" depuis le Module 7 (Antecede Graph)
    const asset = searchParams.get("prefillAsset");
    if (asset) {
      setPrefill({ asset, strategy: searchParams.get("prefillStrategy") ?? undefined });
      setShowForm(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(values: TradeFormValues) {
    const res = await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPayload(values)),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Erreur");
    setShowForm(false);
    await loadTrades();
  }

  async function handleUpdate(values: TradeFormValues) {
    if (!editing) return;
    const res = await fetch(`/api/trades/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPayload(values)),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Erreur");
    setEditing(null);
    await loadTrades();
  }

  async function handleDelete(id: number) {
    if (!confirm("Supprimer ce trade ?")) return;
    await fetch(`/api/trades/${id}`, { method: "DELETE" });
    await loadTrades();
  }

  const canWrite = Boolean(session?.user); // spec 3.3 : Trade Journal éditable par tous les rôles connectés

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Module 8 — Trade Journal</h1>
          <p className="text-sm text-text-secondary">Registre complet des trades et analytics de performance.</p>
        </div>
        {canWrite && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-button bg-link px-4 py-2 text-sm font-medium text-white"
          >
            + Nouveau trade
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : (
        <>
          <TradesTable trades={trades} onEdit={setEditing} onDelete={handleDelete} canWrite={canWrite} />
          <JournalAnalytics trades={trades} />
        </>
      )}

      {showForm && (
        <Modal title="Nouveau trade" onClose={() => setShowForm(false)}>
          <TradeForm initial={prefill} onSubmit={handleCreate} onCancel={() => setShowForm(false)} submitLabel="Créer" />
        </Modal>
      )}

      {editing && (
        <Modal title={`Éditer — ${editing.asset}`} onClose={() => setEditing(null)}>
          <TradeForm initial={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} submitLabel="Mettre à jour" />
        </Modal>
      )}
    </div>
  );
}
