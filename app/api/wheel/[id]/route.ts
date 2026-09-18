import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/session";
import { serializeWheelCycle } from "@/lib/serialize";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Réservé à l'Admin" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const cycle = await prisma.wheelCycle.update({
    where: { id: Number(id) },
    data: {
      phase: body.phase !== undefined ? Number(body.phase) : undefined,
      strike: body.strike !== undefined ? Number(body.strike) : undefined,
      premium: body.premium !== undefined ? (body.premium === "" ? null : Number(body.premium)) : undefined,
      expiry: body.expiry !== undefined ? (body.expiry ? new Date(body.expiry) : null) : undefined,
      sl: body.sl !== undefined ? (body.sl === "" ? null : Number(body.sl)) : undefined,
      result: body.result !== undefined ? (body.result === "" ? null : Number(body.result)) : undefined,
      scenario: body.scenario !== undefined ? body.scenario || null : undefined,
      pnl: body.pnl !== undefined ? (body.pnl === "" ? null : Number(body.pnl)) : undefined,
      status: body.status ?? undefined,
    },
  });

  return NextResponse.json(serializeWheelCycle(cycle));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Réservé à l'Admin" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.wheelCycle.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
