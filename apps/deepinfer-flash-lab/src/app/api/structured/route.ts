import { validateJson } from "@/lib/validate";
import { MAX_PROMPT_CHARS, runStructured } from "@/server/provider";

export const maxDuration = 45;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { presetId?: unknown; schema?: unknown; prompt?: unknown };
  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, MAX_PROMPT_CHARS) : "";
  if (!prompt) return Response.json({ error: "prompt is required" }, { status: 400 });
  if (!body.schema || typeof body.schema !== "object" || Array.isArray(body.schema)) {
    return Response.json({ error: "schema must be a JSON object" }, { status: 400 });
  }
  const schema = body.schema as object;
  const started = Date.now();
  const result = await runStructured(process.env, {
    presetId: typeof body.presetId === "string" ? body.presetId : undefined,
    schema,
    prompt,
  });
  const serverMs = Date.now() - started;
  return Response.json({ ...result, serverMs, validation: validateJson(schema, result.raw) });
}
