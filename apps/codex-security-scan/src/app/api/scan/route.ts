import { NextResponse } from "next/server";
import { runScan } from "@/server/scan";
import type { ScanMode, TargetId } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const TARGETS: TargetId[] = ["sample", "chronicle"];
const MODES: ScanMode[] = ["scripted", "sdk-mock", "live"];

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { target?: string; mode?: string };
  const target = body.target as TargetId;
  const mode = (body.mode ?? "scripted") as ScanMode;
  if (!TARGETS.includes(target) || !MODES.includes(mode)) {
    return NextResponse.json({ error: "target must be sample|chronicle, mode scripted|sdk-mock|live" }, { status: 400 });
  }
  return NextResponse.json(await runScan(target, mode));
}
