import type { Trade, Position, WheelCycle, MarketRecap, AntecedeNode, AntecedeEdge, Alert } from "@prisma/client";
import type {
  TradeDTO,
  PositionDTO,
  WheelCycleDTO,
  MarketRecapDTO,
  AntecedeNodeDTO,
  AntecedeEdgeDTO,
  AntecedeNodeType,
  AlertDTO,
} from "@/lib/types";

function num(d: unknown): number | null {
  if (d === null || d === undefined) return null;
  return Number(d);
}

export function serializeTrade(t: Trade): TradeDTO {
  return {
    id: t.id,
    userId: t.userId,
    asset: t.asset,
    strategy: t.strategy,
    direction: t.direction,
    entryPrice: num(t.entryPrice),
    entryDate: t.entryDate ? t.entryDate.toISOString() : null,
    exitPrice: num(t.exitPrice),
    exitDate: t.exitDate ? t.exitDate.toISOString() : null,
    sizingUsd: num(t.sizingUsd),
    sizingPct: num(t.sizingPct),
    sl: num(t.sl),
    tp1: num(t.tp1),
    tp2: num(t.tp2),
    thesis: t.thesis,
    lesson: t.lesson,
    pnlUsd: num(t.pnlUsd),
    pnlPct: num(t.pnlPct),
    tags: t.tags,
    status: t.status as "open" | "closed",
    createdAt: t.createdAt.toISOString(),
  };
}

export function serializeWheelCycle(c: WheelCycle): WheelCycleDTO {
  return {
    id: c.id,
    phase: c.phase,
    strike: num(c.strike),
    premium: num(c.premium),
    expiry: c.expiry ? c.expiry.toISOString() : null,
    sl: num(c.sl),
    result: num(c.result),
    scenario: c.scenario,
    pnl: num(c.pnl),
    status: c.status as "open" | "closed",
    createdAt: c.createdAt.toISOString(),
  };
}

export function serializeMarketRecap(r: MarketRecap): MarketRecapDTO {
  return {
    id: r.id,
    date: r.date.toISOString(),
    content: r.content,
    generatedAt: r.generatedAt.toISOString(),
    modelUsed: r.modelUsed,
    pinned: r.pinned,
  };
}

export function serializeAntecedeNode(n: AntecedeNode): AntecedeNodeDTO {
  return {
    id: n.id,
    name: n.name,
    type: n.type as AntecedeNodeType,
    description: n.description,
    ticker: n.ticker,
    chokepoint: n.chokepoint,
  };
}

export function serializeAntecedeEdge(e: AntecedeEdge): AntecedeEdgeDTO {
  return {
    id: e.id,
    sourceId: e.sourceId,
    targetId: e.targetId,
    edgeType: e.edgeType,
    edgeCategory: e.edgeCategory as AntecedeEdgeDTO["edgeCategory"],
    weightFinancialPct: e.weightFinancialPct,
    direction: e.direction,
    status: e.status,
    confidence: e.confidence,
    chokepointType: e.chokepointType,
    note: e.note,
  };
}

export function serializeAlert(a: Alert): AlertDTO {
  return {
    id: a.id,
    type: a.type,
    asset: a.asset,
    title: a.title,
    description: a.description,
    severity: a.severity,
    relevanceScore: a.relevanceScore,
    outcome: a.outcome as AlertDTO["outcome"],
    createdAt: a.createdAt.toISOString(),
  };
}

export function serializePosition(p: Position): PositionDTO {
  return {
    id: p.id,
    userId: p.userId,
    ticker: p.ticker,
    entryPrice: Number(p.entryPrice),
    entryDate: p.entryDate.toISOString(),
    quantity: Number(p.quantity),
    sl: num(p.sl),
    tp1: num(p.tp1),
    tp2: num(p.tp2),
    status: p.status,
    createdAt: p.createdAt.toISOString(),
  };
}
