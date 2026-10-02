import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SuggestRequest, SuggestResponse } from "@/lib/types";

export const MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5-5";
type Effort = "low" | "medium" | "high" | "xhigh" | "max";
const EFFORT = (process.env.ANTHROPIC_EFFORT?.trim() || "low") as Effort;

export function liveAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function client() {
  // Multi-workspace / identity-linked keys need anthropic-workspace-id on every request.
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  return new Anthropic(workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : undefined);
}

const SYSTEM = `You write Claude Code mods: a single TypeScript hooks module.
Contract (follow exactly):
- export function register(on: any) { ... }
- on(eventName, [matcher], async ($: any, e: any, next: any) => result). matcher is an object whose fields are compared
  with the event's (value, array of values, or RegExp).
- Observe: return next(e). Rewrite: return next({ ...e, field: newValue }) — events are frozen, never assign to e.
  Answer/deny: return without calling next, e.g. { deny: 'reason Claude can act on' } for tool.call.
- Events available in this playground:
  tool.call  — e.tool ('Bash', 'Edit', ...) plus the tool's args as fields (e.command for Bash, e.file_path for Edit)
  tool.check — e.tool, e.input; await next(e) gives 'allow' | 'ask' | 'deny'; return { decision, reason } to overrule
  prompt.submit — e.text, e.context?; return next({...e, text}) or { drop: 'reason' }
  ui.render — e.component (e.g. 'Spinner'), e.props
- $ (simulated): $.ui.log(msg), $.ui.invalidate('ui.render'), await $.ui.ask(question, options),
  await $.process.run(argv) -> { stdout, stderr, exitCode }.
- No imports. Keep it under 40 lines with short comments. Type parameters as any.`;

/** Ask Claude to draft a mod for the user's intent, aimed at the currently selected event. */
export async function suggestMod(req: SuggestRequest): Promise<SuggestResponse> {
  const res = await client().beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: EFFORT,
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            name: { type: "string", description: "kebab-case mod name" },
            explanation: { type: "string", description: "one or two sentences: what it does to the selected event" },
            code: { type: "string", description: "the full hooks module source" },
          },
          required: ["name", "explanation", "code"],
          additionalProperties: false,
        },
      },
    },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `What the mod should do: ${req.intent.slice(0, 1000)}`,
          `Selected sample event (test target): ${JSON.stringify(req.event).slice(0, 2000)}`,
          req.current ? `Current editor source (may be replaced):\n${req.current.slice(0, 4000)}` : "",
        ].join("\n\n"),
      },
    ],
  });
  if (res.stop_reason === "refusal") throw new Error("Claude declined to write this mod.");
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const data = JSON.parse(text) as Omit<SuggestResponse, "model">;
  return { ...data, model: res.model };
}
