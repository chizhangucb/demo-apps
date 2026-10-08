import { harnessByBase } from "@/lib/catalog";
import { handle, json, registry, sessionTurns } from "@/server/uhp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, ctx: RouteContext<"/api/uhp/v1/sessions/[id]">) => {
  const { id } = await ctx.params;
  const { spec, info } = sessionTurns(id, new URL(req.url));
  const running = registry.active.get(id);
  return json({
    id,
    object: "session",
    harness_id: harnessByBase(info.h)!.id,
    created_at: Math.floor(info.st / 1000),
    status: running ? "running" : "idle",
    turn_count: spec?.turns.length ?? 0,
    metadata: { task_id: info.t },
  });
});
