import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/session";
import { getQuotes, isMarketDataConfigured } from "@/lib/market-data";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isMarketDataConfigured()) {
    return NextResponse.json({ configured: false, quotes: {} });
  }

  const tickersParam = req.nextUrl.searchParams.get("tickers") ?? "";
  const tickers = tickersParam.split(",").map((t) => t.trim()).filter(Boolean);
  if (tickers.length === 0) return NextResponse.json({ configured: true, quotes: {} });

  const quotes = await getQuotes(tickers);
  return NextResponse.json({ configured: true, quotes });
}
