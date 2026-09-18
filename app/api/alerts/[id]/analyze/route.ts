import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/session";
import { getAnthropicClient, isAnthropicConfigured } from "@/lib/anthropic-client";
import type Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAnthropicConfigured()) {
    return NextResponse.json({ error: "Configure ANTHROPIC_API_KEY dans .env.local pour activer l'analyse." }, { status: 503 });
  }

  const { id } = await params;
  const alert = await prisma.alert.findUnique({ where: { id: Number(id) } });
  if (!alert) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const client = getAnthropicClient()!;
  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 800,
    system:
      "Tu es analyste pour un hedge fund. Analyse rapidement cette alerte de marché et propose une réaction concrète en 3-4 phrases (asset concerné, direction, niveau de conviction).",
    messages: [{ role: "user", content: `Alerte : ${alert.title}\n\n${alert.description ?? ""}` }],
  });

  const analysis = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  return NextResponse.json({ analysis });
}
