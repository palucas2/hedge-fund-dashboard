import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/session";
import { serializeMarketRecap } from "@/lib/serialize";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  if (body.pinned === true) {
    // spec : "Pin comme Alpha" — un seul brief épinglé à la fois
    await prisma.marketRecap.updateMany({ where: { pinned: true }, data: { pinned: false } });
  }

  const recap = await prisma.marketRecap.update({
    where: { id: Number(id) },
    data: { pinned: body.pinned },
  });

  return NextResponse.json(serializeMarketRecap(recap));
}
