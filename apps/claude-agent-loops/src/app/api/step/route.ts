import { NextResponse } from "next/server";
import { liveAct, liveAvailable, liveJudge } from "@/server/claude";
import type { LiveActRequest, LiveJudgeRequest } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** One live loop phase: `act` (Claude does a turn) or `judge` (Claude grades non-rule criteria). */
export async function POST(req: Request) {
  if (!liveAvailable()) {
    return NextResponse.json({ error: "Live mode needs ANTHROPIC_API_KEY on the server." }, { status: 503 });
  }
  const body = (await req.json()) as LiveActRequest | LiveJudgeRequest;
  try {
    if (body.phase === "act") return NextResponse.json(await liveAct(body));
    if (body.phase === "judge") return NextResponse.json(await liveJudge(body));
    return NextResponse.json({ error: "Unknown phase" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const hint = /workspace-id|not scoped to a workspace|identity-linked/i.test(msg)
      ? " Set ANTHROPIC_WORKSPACE_ID or use a workspace-scoped key."
      : "";
    return NextResponse.json({ error: msg + hint }, { status: 502 });
  }
}
