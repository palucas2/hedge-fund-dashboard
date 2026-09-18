import { NextResponse } from "next/server";
import { auth } from "@/lib/session";
import { computeAllRegimes, computeGlobalRegime } from "@/lib/regime";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assets = await computeAllRegimes();
  const globalRegime = computeGlobalRegime(assets);

  return NextResponse.json({ assets, globalRegime });
}
