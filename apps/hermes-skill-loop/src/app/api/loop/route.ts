import { NextResponse } from "next/server";
import { liveAvailable, liveExtract, liveRun } from "@/server/claude";
import type { LiveExtractRequest, LiveRunRequest } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** One live skill-loop phase: `run` (Claude runs a task, optionally with a skill) or `extract` (distil a skill). */
export async function POST(req: Request) {
  if (!liveAvailable()) {
    return NextResponse.json({ error: "Live mode needs ANTHROPIC_API_KEY on the server." }, { status: 503 });
  }
  const body = (await req.json()) as LiveRunRequest | LiveExtractRequest;
  try {
    if (body.phase === "run") return NextResponse.json(await liveRun(body));
    if (body.phase === "extract") return NextResponse.json(await liveExtract(body));
    return NextResponse.json({ error: "Unknown phase" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const hint = /workspace-id|not scoped to a workspace|identity-linked/i.test(msg)
      ? " Set ANTHROPIC_WORKSPACE_ID or use a workspace-scoped key."
      : "";
    return NextResponse.json({ error: msg + hint }, { status: 502 });
  }
}
