import { encodeSse, type RunAgentInput } from "@/lib/agui";
import { runAgent } from "@/server/agent";
import { liveAvailable, liveWriter } from "@/server/claude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** AG-UI endpoint: POST a RunAgentInput, get the run back as text/event-stream. */
export async function POST(req: Request) {
  let input: RunAgentInput;
  try {
    input = (await req.json()) as RunAgentInput;
  } catch {
    return Response.json({ error: "Body must be a RunAgentInput JSON object." }, { status: 400 });
  }
  if (typeof input?.threadId !== "string" || typeof input?.runId !== "string") {
    return Response.json({ error: "threadId and runId are required." }, { status: 400 });
  }

  const events = runAgent(input, { live: liveAvailable() ? liveWriter : undefined });
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await events.next();
        if (done) controller.close();
        else controller.enqueue(encodeSse(value));
      } catch (err) {
        controller.enqueue(encodeSse({ type: "RUN_ERROR", message: err instanceof Error ? err.message : String(err) }));
        controller.close();
      }
    },
    async cancel() {
      await events.return(undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
