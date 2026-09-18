import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/session";
import { serializeAlert } from "@/lib/serialize";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const alert = await prisma.alert.update({
    where: { id: Number(id) },
    data: { outcome: body.outcome },
  });

  return NextResponse.json(serializeAlert(alert));
}
