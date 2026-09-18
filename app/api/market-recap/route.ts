import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/session";
import { serializeMarketRecap } from "@/lib/serialize";
import { generateMarketRecap, isMarketRecapConfigured } from "@/lib/market-recap";

export const maxDuration = 60; // spec : génération ~30-60s — étend le timeout Vercel pour cette route

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const recaps = await prisma.marketRecap.findMany({ orderBy: { date: "desc" } });
  return NextResponse.json({ configured: isMarketRecapConfigured(), recaps: recaps.map(serializeMarketRecap) });
}

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isMarketRecapConfigured()) {
    return NextResponse.json(
      { error: "Configure ANTHROPIC_API_KEY dans .env.local pour activer la génération." },
      { status: 503 }
    );
  }

  const result = await generateMarketRecap();
  if (!result) {
    return NextResponse.json({ error: "La génération a échoué." }, { status: 502 });
  }

  const recap = await prisma.marketRecap.create({
    data: {
      date: new Date(new Date().toDateString()),
      content: result.content,
      modelUsed: result.modelUsed,
    },
  });

  return NextResponse.json(serializeMarketRecap(recap), { status: 201 });
}
