import { compareLive, tokenConfigured } from "@/server/space";
import { ENDPOINT, SPACE_ID } from "@/lib/live";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ endpoint: ENDPOINT, space: SPACE_ID, tokenConfigured: tokenConfigured() });
}

export async function POST(req: Request) {
  let body: { problem?: unknown; maxNewTokens?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ status: "rejected", message: "Body must be JSON." }, { status: 400 });
  }
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const out = await compareLive(ip, body.problem, body.maxNewTokens);
  return Response.json(out);
}
