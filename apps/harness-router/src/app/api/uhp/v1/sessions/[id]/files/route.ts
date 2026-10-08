import { handle, json, sessionFiles, sessionTurns } from "@/server/uhp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every artifact of the session, earlier tasks included. */
export const GET = handle(async (req: Request, ctx: RouteContext<"/api/uhp/v1/sessions/[id]/files">) => {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const { spec } = sessionTurns(id, url);
  return json({ files: sessionFiles(spec, url.origin) });
});
