export type TradeDTO = {
  id: number;
  userId: number | null;
  asset: string;
  strategy: string | null;
  direction: string;
  entryPrice: number | null;
  entryDate: string | null;
  exitPrice: number | null;
  exitDate: string | null;
  sizingUsd: number | null;
  sizingPct: number | null;
  sl: number | null;
  tp1: number | null;
  tp2: number | null;
  thesis: string | null;
  lesson: string | null;
  pnlUsd: number | null;
  pnlPct: number | null;
  tags: string | null;
  status: "open" | "closed";
  createdAt: string;
};

export type PositionDTO = {
  id: number;
  userId: number | null;
  ticker: string;
  entryPrice: number;
  entryDate: string;
  quantity: number;
  sl: number | null;
  tp1: number | null;
  tp2: number | null;
  status: string;
  createdAt: string;
};

export const STRATEGIES = ["Géopolitique", "Wheel BTC", "Algo", "ETF Thématique", "Autre"] as const;
export const TAGS = ["Géopolitique", "Earnings", "Regime", "Technique", "Macro"] as const;
export const DEFAULT_ETF_TICKERS = ["EWZ", "CIBR", "ITA", "XLE", "HACK", "XOP", "EMGF"] as const;

export type WheelCycleDTO = {
  id: number;
  phase: number; // 1 = put vendu | 2 = call vendu
  strike: number | null;
  premium: number | null;
  expiry: string | null;
  sl: number | null;
  result: number | null;
  scenario: string | null;
  pnl: number | null;
  status: "open" | "closed";
  createdAt: string;
};

export const WHEEL_SCENARIOS = ["expire", "sl_triggered", "crash_slippage"] as const;
export const WHEEL_SCENARIO_LABELS: Record<(typeof WHEEL_SCENARIOS)[number], string> = {
  expire: "Expiration (prime gardée)",
  sl_triggered: "Stop-loss déclenché",
  crash_slippage: "Crash / slippage",
};

export type MarketRecapDTO = {
  id: number;
  date: string;
  content: string;
  generatedAt: string;
  modelUsed: string | null;
  pinned: boolean;
};

export type AntecedeNodeType = "company" | "country" | "alliance" | "resource" | "program";

export type AntecedeNodeDTO = {
  id: string;
  name: string;
  type: AntecedeNodeType;
  description: string | null;
  ticker: string | null;
  chokepoint: boolean;
};

export type AntecedeEdgeDTO = {
  id: number;
  sourceId: string;
  targetId: string;
  edgeType: string;
  edgeCategory: "conflict" | "trade" | "dependency" | "alliance";
  weightFinancialPct: number | null;
  direction: string | null;
  status: string | null;
  confidence: string | null;
  chokepointType: string | null;
  note: string | null;
};

export const ALERT_TYPES = ["earnings", "volume", "geopolitical", "central_bank", "price_move"] as const;
export const ALERT_TYPE_LABELS: Record<(typeof ALERT_TYPES)[number], string> = {
  earnings: "Earnings Surprise",
  volume: "Volume inhabituel",
  geopolitical: "Conflit géopolitique",
  central_bank: "Banque centrale",
  price_move: "Mouvement de prix",
};

export const ALERT_SEVERITIES = ["red", "orange", "yellow"] as const;
export const ALERT_OUTCOMES = ["exploited", "ignored", "missed", "pending"] as const;
export const ALERT_OUTCOME_LABELS: Record<(typeof ALERT_OUTCOMES)[number], string> = {
  exploited: "Exploité ✅",
  ignored: "Ignoré ➡️",
  missed: "Raté ❌",
  pending: "En attente",
};

export type AlertDTO = {
  id: number;
  type: string;
  asset: string | null;
  title: string;
  description: string | null;
  severity: string | null;
  relevanceScore: number | null;
  outcome: (typeof ALERT_OUTCOMES)[number];
  createdAt: string;
};
