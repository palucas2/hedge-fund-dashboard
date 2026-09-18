import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/session";
import { serializeWheelCycle } from "@/lib/serialize";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cycles = await prisma.wheelCycle.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(cycles.map(serializeWheelCycle));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Réservé à l'Admin" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.phase || !body.strike) {
    return NextResponse.json({ error: "phase et strike sont requis" }, { status: 400 });
  }

  const cycle = await prisma.wheelCycle.create({
    data: {
      phase: Number(body.phase),
      strike: Number(body.strike),
      premium: body.premium !== undefined && body.premium !== "" ? Number(body.premium) : null,
      expiry: body.expiry ? new Date(body.expiry) : null,
      sl: body.sl !== undefined && body.sl !== "" ? Number(body.sl) : null,
      status: "open",
    },
  });

  return NextResponse.json(serializeWheelCycle(cycle), { status: 201 });
}
