import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/session";

/**
 * "Partager" (spec) : pas d'infra de push notification — crée une alerte réelle en base
 * (table `alerts`, déjà en place). Sera visible dans le feed d'alertes une fois le
 * Module 9 (Volatility Tracker) construit.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const recap = await prisma.marketRecap.findUnique({ where: { id: Number(id) } });
  if (!recap) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.alert.create({
    data: {
      type: "market_recap_share",
      title: `Market Recap partagé — ${recap.date.toISOString().slice(0, 10)}`,
      description: recap.content.slice(0, 300),
      severity: "yellow",
    },
  });

  return NextResponse.json({ ok: true });
}
