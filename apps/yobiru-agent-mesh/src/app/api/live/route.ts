import { liveAvailable, liveText, MAX_CALLS_PER_RUN, MODEL } from "@/server/claude";

// Per-run call counter (best effort, per server instance) on top of the client side cap.
const calls = new Map<string, number>();

export async function GET() {
  return Response.json({ live: liveAvailable(), model: liveAvailable() ? MODEL : null, maxCalls: MAX_CALLS_PER_RUN });
}

export async function POST(req: Request) {
  if (!liveAvailable()) return Response.json({ error: "scripted mode" }, { status: 404 });
  const { runId, slot } = (await req.json().catch(() => ({}))) as { runId?: string; slot?: string };
  if (!runId || !slot) return Response.json({ error: "runId and slot required" }, { status: 400 });
  const used = calls.get(runId) ?? 0;
  if (used >= MAX_CALLS_PER_RUN) return Response.json({ error: "call cap reached" }, { status: 429 });
  calls.set(runId, used + 1);
  if (calls.size > 500) calls.delete(calls.keys().next().value!);
  try {
    return Response.json(await liveText(slot));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 502 });
  }
}
