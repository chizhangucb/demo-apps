import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { MODEL_SPEC_SCHEMA, validateSpec, type ModelSpec } from "@/lib/modelspec";

export const MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5-5";
type Effort = "low" | "medium" | "high" | "xhigh" | "max";
const EFFORT = (process.env.ANTHROPIC_EFFORT?.trim() || "low") as Effort;
/** One finite attempt: no SDK retries, and well inside the route's maxDuration. */
export const TIMEOUT_MS = 50_000;

export function liveAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function client() {
  // Multi-workspace / identity-linked keys need anthropic-workspace-id on every request.
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  return new Anthropic({
    timeout: TIMEOUT_MS,
    maxRetries: 0,
    ...(workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {}),
  });
}

// A condensed brief of the cutaway skill (upstream SKILL.md and docs/, MIT): rebuild from primitives, never import the
// picture, the look, the checklist and what to measure. One pass only; the lab says so on the page.
const SYSTEM = `You rebuild a mechanical object from one reference picture as a procedural 3D model made only of primitives.
This is a single pass of the cutaway method (github.com/Nyxera0x/cutaway), not its full review loop.

Rules:
- Start from the picture, never from imagination. Rebuild it in code only: the picture is never used as a texture or mesh.
- Read the picture's proportions first (length to height, head to body, limb thickness) and keep them.
- The look: white glossy shells (material "shell"), green only as sparse accents on tips, rims, edges and joint rings
  ("accent", never dots on a shell), dark mechanism showing through plate gaps ("graphite", "steel"), glossy black lens
  eyes ("lens") with a thin green bezel, milky frosted membranes or glass ("glass"), "black" for deep gaps.
- Dense core, shell plates in 3 sizes with gaps. One main set of limbs. Bristles and spikes 0.15 to 0.25 of limb thickness.
- 4 to 8 named parts that can come apart (for example optics, a limb, a wing, a shell, a core). Each part is a list of
  1 to 24 primitives. A primitive is a unit shape that fits a 1x1x1 box (box, sphere, cylinder along y, cone along y,
  torus in the xy plane, capsule along y), scaled by size [x,y,z], placed at pos [x,y,z], rotated by rot [x,y,z] degrees.
- Coordinates: y up, the object about 3 units long along x, head toward +x, centred near the origin, all within -3..3.
- anchor: a point on the part's surface where its label sits. explode: the offset [x,y,z] the part moves when the
  object comes apart (about 0.6 to 1.6 units, away from the core, parts not colliding).
- checklist: 10 to 12 short checks of what the picture shows (silhouette, proportions, eye, limbs, accent placement,
  materials), each graded yes, partial or no against the model you wrote. Be honest: primitives lose detail.
- simplified: one or two sentences on what was simplified.
- name: invent a product name (one word) and a code like PX-7. kind: what it is, e.g. "Robotic beetle".`;

export type GenerateResult = { spec: ModelSpec; warnings: string[]; model: string; ms: number };

export class LiveError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** One Sonnet call: image in, ModelSpec JSON out, validated before it leaves the server. */
export async function generateSpec(image: { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" }): Promise<GenerateResult> {
  const t0 = Date.now();
  let res;
  try {
    res = await client().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: EFFORT, format: { type: "json_schema", schema: MODEL_SPEC_SCHEMA as unknown as Record<string, unknown> } },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
            { type: "text", text: "Rebuild this object as a ModelSpec. Keep the total under 120 primitives." },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.APIConnectionTimeoutError) throw new LiveError(`Claude did not answer within ${TIMEOUT_MS / 1000} s.`, 504);
    if (err instanceof Anthropic.AuthenticationError) throw new LiveError("The server's Anthropic key was rejected.", 502);
    if (err instanceof Anthropic.RateLimitError) throw new LiveError("Claude is rate limited right now. Try again later.", 429);
    if (err instanceof Anthropic.APIError) {
      const hint = /workspace/i.test(err.message) ? " Set ANTHROPIC_WORKSPACE_ID or use a workspace-scoped key." : "";
      throw new LiveError(`Claude API error ${err.status ?? ""}: ${err.message}${hint}`.trim(), 502);
    }
    throw new LiveError(err instanceof Error ? err.message : String(err), 502);
  }
  if (res.stop_reason === "refusal") throw new LiveError("Claude declined this picture.", 422);
  if (res.stop_reason === "max_tokens") throw new LiveError("The model spec ran past the output cap.", 502);
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new LiveError("Claude returned something that is not JSON.", 502);
  }
  const v = validateSpec(raw);
  if (!v.ok) throw new LiveError(`The model spec failed validation: ${v.errors.slice(0, 4).join("; ")}`, 502);
  return { spec: v.spec, warnings: v.warnings, model: res.model, ms: Date.now() - t0 };
}
