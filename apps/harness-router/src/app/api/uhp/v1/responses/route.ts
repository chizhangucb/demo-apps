import { createRun, handle, json, streamRun, waitForRun, storedResponse } from "@/server/uhp";
import { UHP_VERSION } from "@/lib/uhp/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Longest script (research brief on Claude Code) is ~20s; leave headroom.
export const maxDuration = 60;

/** POST /v1/responses: run a task on the harness named by metadata.harness_id. */
export const POST = handle(async (req: Request) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const origin = new URL(req.url).origin;
  const { run, req: request } = createRun(body, origin);

  if (!request.stream) {
    if (request.background) return json(storedResponse(run));
    return json(await waitForRun(run));
  }

  const events = streamRun(run);
  const encoder = new TextEncoder();
  let keepAlive: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      keepAlive = setInterval(() => controller.enqueue(encoder.encode(": keep-alive\n\n")), 15_000);
    },
    async pull(controller) {
      const { value, done } = await events.next();
      if (done) {
        clearInterval(keepAlive);
        controller.close();
      } else {
        controller.enqueue(encoder.encode(value));
      }
    },
    async cancel() {
      // A dropped connection does not abort the task: the stored response keeps advancing.
      clearInterval(keepAlive);
      await events.return(undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "UHP-Version": UHP_VERSION,
    },
  });
});
