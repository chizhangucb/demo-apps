import { resolveMode } from "@/lib/mode";

// Which mode, provider and model id are active. Never the key.
export async function GET() {
  return Response.json(resolveMode(process.env), { headers: { "Cache-Control": "no-store" } });
}
