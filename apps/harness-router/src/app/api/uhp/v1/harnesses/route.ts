import { HARNESSES, publicHarness } from "@/lib/catalog";
import { json } from "@/server/uhp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return json({ harnesses: HARNESSES.map(publicHarness) });
}
