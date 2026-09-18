import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/session";
import { getCompanyOverview, isFundamentalsConfigured } from "@/lib/market-data";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ticker = req.nextUrl.searchParams.get("ticker") ?? "";
  if (!ticker) return NextResponse.json({ configured: isFundamentalsConfigured(), overview: null });

  const overview = await getCompanyOverview(ticker);
  return NextResponse.json({ configured: isFundamentalsConfigured(), overview });
}
