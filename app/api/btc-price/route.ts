import { NextResponse } from "next/server";
import { auth } from "@/lib/session";
import { getBtcPrice } from "@/lib/btc-price";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quote = await getBtcPrice();
  return NextResponse.json({ quote });
}
