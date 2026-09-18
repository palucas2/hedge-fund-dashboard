import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/session";
import { serializePosition } from "@/lib/serialize";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Réservé à l'Admin" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const position = await prisma.position.update({
    where: { id: Number(id) },
    data: {
      ticker: body.ticker !== undefined ? body.ticker.toUpperCase() : undefined,
      entryPrice: body.entryPrice !== undefined ? Number(body.entryPrice) : undefined,
      entryDate: body.entryDate !== undefined ? new Date(body.entryDate) : undefined,
      quantity: body.quantity !== undefined ? Number(body.quantity) : undefined,
      sl: body.sl !== undefined ? (body.sl === "" ? null : Number(body.sl)) : undefined,
      tp1: body.tp1 !== undefined ? (body.tp1 === "" ? null : Number(body.tp1)) : undefined,
      tp2: body.tp2 !== undefined ? (body.tp2 === "" ? null : Number(body.tp2)) : undefined,
      status: body.status ?? undefined,
    },
  });

  return NextResponse.json(serializePosition(position));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Réservé à l'Admin" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.position.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
