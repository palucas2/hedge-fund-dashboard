import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/session";
import { searchNodes } from "@/lib/antecede";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q) return NextResponse.json([]);

  const results = await searchNodes(q);
  return NextResponse.json(results);
}
