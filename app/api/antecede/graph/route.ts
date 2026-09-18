import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/session";
import { getFullGraph, getSubgraph } from "@/lib/antecede";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entity = req.nextUrl.searchParams.get("entity");
  const graph = entity ? await getSubgraph(entity) : await getFullGraph();
  if (!graph) return NextResponse.json({ error: "Entité inconnue" }, { status: 404 });

  return NextResponse.json(graph);
}
