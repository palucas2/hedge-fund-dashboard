import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/session";
import { searchNewsForEntity } from "@/lib/news";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const name = req.nextUrl.searchParams.get("name") ?? "";
  if (!name) return NextResponse.json([]);

  const items = await searchNewsForEntity(name);
  return NextResponse.json(items);
}
