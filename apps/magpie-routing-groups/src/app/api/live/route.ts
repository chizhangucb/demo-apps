import { liveAvailable, liveReply, MAX_CALLS_PER_RUN, MODEL } from "@/server/claude";

// Per-run call counter (best effort, per server instance) on top of the client side cap.
const calls = new Map<string, number>();

export async function GET() {
  return Response.json({ live: liveAvailable(), model: liveAvailable() ? MODEL : null, maxCalls: MAX_CALLS_PER_RUN });
}

export async function POST(req: Request) {
  if (!liveAvailable()) return Response.json({ error: "scripted mode" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { runId?: string; agent?: string; prompt?: string; servedAs?: string };
  if (!body.runId || !body.agent || !body.prompt || !body.servedAs) return Response.json({ error: "runId, agent, prompt, servedAs required" }, { status: 400 });
  const used = calls.get(body.runId) ?? 0;
  if (used >= MAX_CALLS_PER_RUN) return Response.json({ error: "call cap reached" }, { status: 429 });
  calls.set(body.runId, used + 1);
  if (calls.size > 500) calls.delete(calls.keys().next().value!);
  try {
    return Response.json(await liveReply(body.agent, body.prompt, body.servedAs));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 502 });
  }
}
