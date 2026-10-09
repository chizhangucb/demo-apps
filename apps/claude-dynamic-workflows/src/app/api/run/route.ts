import { getTask } from "@/lib/tasks";
import { runTask } from "@/lib/workflow/run";
import type { RunEvent } from "@/lib/workflow/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The longest preset runs about 25s at 1x; leave headroom for slow speed.
export const maxDuration = 120;

const CHUNK_MS = 170;

/** POST /api/run { taskId, speed? }: runs the preset workflow and its single-context baseline, streamed as SSE. */
export async function POST(req: Request) {
  let body: { taskId?: unknown; speed?: unknown } = {};
  try {
    body = await req.json();
  } catch {}
  const task = typeof body.taskId === "string" ? getTask(body.taskId) : null;
  if (!task) return Response.json({ error: "unknown taskId" }, { status: 400 });
  const speed = typeof body.speed === "number" && body.speed >= 0.25 && body.speed <= 4 ? body.speed : 1;

  const encoder = new TextEncoder();
  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort());
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: RunEvent) => {
        if (abort.signal.aborted) return;
        controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
      };
      try {
        await runTask(task, emit, { chunkMs: CHUNK_MS / speed, signal: abort.signal });
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
      }
      if (!abort.signal.aborted) controller.close();
    },
    cancel() {
      abort.abort();
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
