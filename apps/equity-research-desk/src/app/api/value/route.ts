import type { DcfConfig } from "@/lib/types";
import { runDcf } from "@/server/dcf";

export const maxDuration = 60;

/** POST a dcf.py assumptions JSON, get the structured valuation back. */
export async function POST(req: Request) {
  const text = await req.text();
  if (text.length > 200_000) return Response.json({ error: "assumptions too large" }, { status: 413 });
  try {
    const config = JSON.parse(text) as DcfConfig;
    return Response.json(await runDcf(config, new URL(req.url).origin));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
