import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/session";
import { analyzeEntityWithClaude } from "@/lib/antecede";
import { isAnthropicConfigured } from "@/lib/anthropic-client";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAnthropicConfigured()) {
    return NextResponse.json({ error: "Configure ANTHROPIC_API_KEY dans .env.local pour activer l'analyse." }, { status: 503 });
  }

  const { nodeId } = await req.json();
  const analysis = await analyzeEntityWithClaude(nodeId);
  if (!analysis) return NextResponse.json({ error: "Analyse impossible" }, { status: 502 });

  return NextResponse.json({ analysis });
}
