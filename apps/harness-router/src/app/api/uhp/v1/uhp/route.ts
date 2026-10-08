import { json } from "@/server/uhp";
import { UHP_VERSION, type Discovery } from "@/lib/uhp/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /v1/uhp: discovery (no auth). Unsupported capabilities are reported false, never omitted. */
export async function GET() {
  const body: Discovery = {
    object: "uhp.discovery",
    protocol: "uhp",
    versions: [UHP_VERSION],
    default_version: UHP_VERSION,
    conformance_class: "core",
    capabilities: {
      streaming: true,
      sessions: true,
      cancellation: true,
      files_input: true,
      files_output: true,
      session_listing: false,
      harness_management: false,
      session_sharing: false,
      idempotency: false,
    },
  };
  return json(body);
}
