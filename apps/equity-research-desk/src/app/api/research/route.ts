import { research } from "@/server/research";

export const maxDuration = 120;

export async function POST(req: Request) {
  const { ticker } = (await req.json().catch(() => ({}))) as { ticker?: string };
  const run = await research(String(ticker ?? ""), new URL(req.url).origin);
  return Response.json(run);
}
