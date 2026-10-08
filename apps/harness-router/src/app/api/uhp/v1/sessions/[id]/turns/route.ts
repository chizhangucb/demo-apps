import { buildRun } from "@/lib/uhp/engine";
import { encodeResponseId } from "@/lib/uhp/ids";
import { handle, json, sessionTurns, storedResponse, turnSpecs } from "@/server/uhp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, ctx: RouteContext<"/api/uhp/v1/sessions/[id]/turns">) => {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const { spec } = sessionTurns(id, url);
  const turns = turnSpecs(spec).flatMap((turnSpec) => {
    const run = buildRun(turnSpec, url.origin);
    if (!run) return [];
    const resp = storedResponse(run);
    return [
      {
        id: encodeResponseId(turnSpec),
        object: "session.turn",
        status: resp.status,
        user: run.prompt,
        assistant: resp.output.flatMap((o) => (o.type === "message" ? o.content.map((c) => c.text) : [])).join("\n"),
        tools: resp.output.flatMap((o) => (o.type === "function_call" ? [o.name] : [])),
        files: resp.output.flatMap((o) => (o.type === "message" ? o.content.flatMap((c) => c.annotations.map((a) => a.filename)) : [])),
      },
    ];
  });
  return json({ object: "list", data: turns });
});
