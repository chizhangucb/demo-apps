import { NextResponse } from "next/server";
import { liveAvailable, suggestMod } from "@/server/claude";
import type { SuggestRequest } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Live path: Claude drafts a mod for an intent. The draft still runs only in the browser's sandboxed harness. */
export async function POST(req: Request) {
  if (!liveAvailable()) {
    return NextResponse.json({ error: "Live suggestions need ANTHROPIC_API_KEY on the server." }, { status: 503 });
  }
  let body: SuggestRequest;
  try {
    body = (await req.json()) as SuggestRequest;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  if (!body?.intent?.trim() || !body.event) {
    return NextResponse.json({ error: "Send { intent, event }." }, { status: 400 });
  }
  try {
    return NextResponse.json(await suggestMod(body));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const hint = /workspace-id|not scoped to a workspace|identity-linked/i.test(msg)
      ? " Set ANTHROPIC_WORKSPACE_ID or use a workspace-scoped key."
      : "";
    return NextResponse.json({ error: msg + hint }, { status: 502 });
  }
}
