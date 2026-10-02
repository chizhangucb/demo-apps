import { NextResponse } from "next/server";
import { liveAvailable, MODEL } from "@/server/claude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tells the studio whether the optional live path is configured. Never returns the key. */
export function GET() {
  return NextResponse.json({ live: liveAvailable(), model: liveAvailable() ? MODEL : null });
}
