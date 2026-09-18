import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/session";
import { getGeopoliticalNews } from "@/lib/news";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const timeframeHours = Number(req.nextUrl.searchParams.get("hours") ?? "24");
  const pins = await getGeopoliticalNews(timeframeHours);
  return NextResponse.json({ newsApiConfigured: Boolean(process.env.NEWS_API_KEY), pins });
}
