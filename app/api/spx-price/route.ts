import { NextResponse } from "next/server";
import { auth } from "@/lib/session";
import { getYahooQuote } from "@/lib/yahoo-finance";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quote = await getYahooQuote("^GSPC");
  return NextResponse.json({ quote });
}
