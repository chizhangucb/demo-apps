import { cancelRun, handle, json, loadRun } from "@/server/uhp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /v1/responses/{id}/cancel: ends the task as "cancelled", partial output kept. Idempotent. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/uhp/v1/responses/[id]/cancel">) => {
  const { id } = await ctx.params;
  return json(cancelRun(loadRun(id, new URL(req.url).origin)));
});
