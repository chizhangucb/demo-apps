import { handle, json, loadRun, storedResponse } from "@/server/uhp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /v1/responses/{id}: the stored response, rebuilt from the deterministic id. */
export const GET = handle(async (req: Request, ctx: RouteContext<"/api/uhp/v1/responses/[id]">) => {
  const { id } = await ctx.params;
  return json(storedResponse(loadRun(id, new URL(req.url).origin)));
});
