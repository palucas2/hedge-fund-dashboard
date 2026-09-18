import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/session";
import { runWheelMonteCarlo } from "@/lib/monte-carlo";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const required = ["spot", "strikePct", "premiumPct", "volAnnual", "crashProb", "days"];
  for (const key of required) {
    if (body[key] === undefined || body[key] === "") {
      return NextResponse.json({ error: `${key} est requis` }, { status: 400 });
    }
  }

  const result = runWheelMonteCarlo({
    spot: Number(body.spot),
    strikePct: Number(body.strikePct),
    premiumPct: Number(body.premiumPct),
    volAnnual: Number(body.volAnnual),
    crashProb: Number(body.crashProb),
    days: Number(body.days),
    iterations: 1000,
  });

  return NextResponse.json(result);
}
