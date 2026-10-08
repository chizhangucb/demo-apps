import { harnessById, harnessModels } from "@/lib/catalog";
import { handle, json, notFound } from "@/server/uhp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/uhp/v1/harnesses/[id]/models">) => {
  const { id } = await ctx.params;
  const harness = harnessById(id);
  if (!harness) throw notFound("harness_not_found", `Harness ${id}`);
  return json({ object: "list", data: harnessModels(harness) });
});
