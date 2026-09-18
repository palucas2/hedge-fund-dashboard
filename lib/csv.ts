import type { TradeDTO } from "@/lib/types";

const COLUMNS: { key: keyof TradeDTO; label: string }[] = [
  { key: "asset", label: "Asset" },
  { key: "strategy", label: "Stratégie" },
  { key: "direction", label: "Direction" },
  { key: "entryDate", label: "Date entrée" },
  { key: "entryPrice", label: "Prix entrée" },
  { key: "exitDate", label: "Date sortie" },
  { key: "exitPrice", label: "Prix sortie" },
  { key: "sizingUsd", label: "Sizing $" },
  { key: "sizingPct", label: "Sizing %" },
  { key: "sl", label: "SL" },
  { key: "tp1", label: "TP1" },
  { key: "tp2", label: "TP2" },
  { key: "pnlUsd", label: "PnL $" },
  { key: "pnlPct", label: "PnL %" },
  { key: "tags", label: "Tags" },
  { key: "status", label: "Statut" },
  { key: "thesis", label: "Thèse" },
  { key: "lesson", label: "Leçon" },
];

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function tradesToCsv(trades: TradeDTO[]): string {
  const header = COLUMNS.map((c) => c.label).join(",");
  const rows = trades.map((t) => COLUMNS.map((c) => escapeCsv(t[c.key])).join(","));
  return [header, ...rows].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
