import { UHP_VERSION } from "@/lib/uhp/types";
import { handle, readArtifact } from "@/server/uhp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Raw artifact bytes. Artifacts are attacker-influenced, so never let the browser sniff them. */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/uhp/v1/containers/[cid]/files/[fid]/content">) => {
  const { cid, fid } = await ctx.params;
  const artifact = readArtifact(cid, fid);
  const safeName = artifact.filename.replace(/[^A-Za-z0-9._-]/g, "_");
  return new Response(artifact.content, {
    headers: {
      "Content-Type": `${artifact.mimeType}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      "UHP-Version": UHP_VERSION,
    },
  });
});
