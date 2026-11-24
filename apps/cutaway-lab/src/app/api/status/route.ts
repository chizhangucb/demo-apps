import { NextResponse } from "next/server";
import { liveAvailable, MODEL } from "@/server/claude";

export const dynamic = "force-dynamic";

/** Whether Live can run here (a key is configured), never the key itself. */
export function GET() {
  return NextResponse.json({ live: liveAvailable(), model: MODEL });
}
