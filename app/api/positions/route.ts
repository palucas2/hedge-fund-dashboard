import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/session";
import { serializePosition } from "@/lib/serialize";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const positions = await prisma.position.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(positions.map(serializePosition));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Réservé à l'Admin" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.ticker || !body.entryPrice || !body.entryDate || !body.quantity) {
    return NextResponse.json({ error: "ticker, entryPrice, entryDate et quantity sont requis" }, { status: 400 });
  }

  const position = await prisma.position.create({
    data: {
      userId: Number(session.user.id),
      ticker: body.ticker.toUpperCase(),
      entryPrice: Number(body.entryPrice),
      entryDate: new Date(body.entryDate),
      quantity: Number(body.quantity),
      sl: body.sl !== undefined && body.sl !== "" ? Number(body.sl) : null,
      tp1: body.tp1 !== undefined && body.tp1 !== "" ? Number(body.tp1) : null,
      tp2: body.tp2 !== undefined && body.tp2 !== "" ? Number(body.tp2) : null,
    },
  });

  return NextResponse.json(serializePosition(position), { status: 201 });
}
