import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/session";
import { serializeTrade } from "@/lib/serialize";
import { computePnl } from "@/lib/pnl";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const trades = await prisma.trade.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(trades.map(serializeTrade));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.asset || !body.direction) {
    return NextResponse.json({ error: "asset et direction sont requis" }, { status: 400 });
  }

  const entryPrice = body.entryPrice !== undefined && body.entryPrice !== "" ? Number(body.entryPrice) : null;
  const exitPrice = body.exitPrice !== undefined && body.exitPrice !== "" ? Number(body.exitPrice) : null;
  const sizingUsd = body.sizingUsd !== undefined && body.sizingUsd !== "" ? Number(body.sizingUsd) : null;

  const { pnlUsd, pnlPct } = computePnl({ direction: body.direction, entryPrice, exitPrice, sizingUsd });

  const trade = await prisma.trade.create({
    data: {
      userId: Number(session.user.id),
      asset: body.asset,
      strategy: body.strategy || null,
      direction: body.direction,
      entryPrice,
      entryDate: body.entryDate ? new Date(body.entryDate) : null,
      exitPrice,
      exitDate: body.exitDate ? new Date(body.exitDate) : null,
      sizingUsd,
      sizingPct: body.sizingPct !== undefined && body.sizingPct !== "" ? Number(body.sizingPct) : null,
      sl: body.sl !== undefined && body.sl !== "" ? Number(body.sl) : null,
      tp1: body.tp1 !== undefined && body.tp1 !== "" ? Number(body.tp1) : null,
      tp2: body.tp2 !== undefined && body.tp2 !== "" ? Number(body.tp2) : null,
      thesis: body.thesis || null,
      lesson: body.lesson || null,
      pnlUsd: body.pnlUsd !== undefined && body.pnlUsd !== "" ? Number(body.pnlUsd) : pnlUsd,
      pnlPct: body.pnlPct !== undefined && body.pnlPct !== "" ? Number(body.pnlPct) : pnlPct,
      tags: body.tags || null,
      status: exitPrice !== null ? "closed" : "open",
    },
  });

  return NextResponse.json(serializeTrade(trade), { status: 201 });
}
