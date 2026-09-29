import { NextResponse } from "next/server";
import { previewPatch } from "@/server/scan";
import type { Finding, ScanMode, TargetId } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    target?: TargetId;
    mode?: ScanMode;
    finding?: Finding;
  };
  if (!body.finding?.id || (body.target !== "sample" && body.target !== "chronicle")) {
    return NextResponse.json({ error: "target and finding are required" }, { status: 400 });
  }
  return NextResponse.json(await previewPatch(body.target, body.mode ?? "scripted", body.finding));
}
