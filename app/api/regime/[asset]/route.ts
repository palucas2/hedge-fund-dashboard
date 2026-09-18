import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/session";
import { computeRegime } from "@/lib/regime";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ asset: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { asset } = await params;
  const result = await computeRegime(asset);
  if (!result) return NextResponse.json({ error: "Asset inconnu ou données insuffisantes" }, { status: 404 });

  return NextResponse.json(result);
}
