import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/session";
import { serializeTrade } from "@/lib/serialize";
import { computePnl } from "@/lib/pnl";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.trade.findUnique({ where: { id: Number(id) } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  const direction = body.direction ?? existing.direction;
  const entryPrice =
    body.entryPrice !== undefined ? (body.entryPrice === "" ? null : Number(body.entryPrice)) : existing.entryPrice !== null ? Number(existing.entryPrice) : null;
  const exitPrice =
    body.exitPrice !== undefined ? (body.exitPrice === "" ? null : Number(body.exitPrice)) : existing.exitPrice !== null ? Number(existing.exitPrice) : null;
  const sizingUsd =
    body.sizingUsd !== undefined ? (body.sizingUsd === "" ? null : Number(body.sizingUsd)) : existing.sizingUsd !== null ? Number(existing.sizingUsd) : null;

  const autoPnl = computePnl({ direction, entryPrice, exitPrice, sizingUsd });

  const trade = await prisma.trade.update({
    where: { id: Number(id) },
    data: {
      asset: body.asset ?? undefined,
      strategy: body.strategy !== undefined ? body.strategy || null : undefined,
      direction: body.direction ?? undefined,
      entryPrice,
      entryDate: body.entryDate !== undefined ? (body.entryDate ? new Date(body.entryDate) : null) : undefined,
      exitPrice,
      exitDate: body.exitDate !== undefined ? (body.exitDate ? new Date(body.exitDate) : null) : undefined,
      sizingUsd,
      sizingPct: body.sizingPct !== undefined ? (body.sizingPct === "" ? null : Number(body.sizingPct)) : undefined,
      sl: body.sl !== undefined ? (body.sl === "" ? null : Number(body.sl)) : undefined,
      tp1: body.tp1 !== undefined ? (body.tp1 === "" ? null : Number(body.tp1)) : undefined,
      tp2: body.tp2 !== undefined ? (body.tp2 === "" ? null : Number(body.tp2)) : undefined,
      thesis: body.thesis !== undefined ? body.thesis || null : undefined,
      lesson: body.lesson !== undefined ? body.lesson || null : undefined,
      pnlUsd: body.pnlUsd !== undefined ? (body.pnlUsd === "" ? null : Number(body.pnlUsd)) : autoPnl.pnlUsd,
      pnlPct: body.pnlPct !== undefined ? (body.pnlPct === "" ? null : Number(body.pnlPct)) : autoPnl.pnlPct,
      tags: body.tags !== undefined ? body.tags || null : undefined,
      status: body.status ?? (exitPrice !== null ? "closed" : "open"),
    },
  });

  return NextResponse.json(serializeTrade(trade));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.trade.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
