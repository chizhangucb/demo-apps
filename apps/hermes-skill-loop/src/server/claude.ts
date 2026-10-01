import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { LiveExtractRequest, LiveExtractResponse, LiveRunRequest, LiveRunResponse, RunStep } from "@/lib/types";
import { skillToMarkdown } from "@/lib/harness";

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

async function json<T>(system: string, user: string, schema: Record<string, unknown>) {
  const res = await client().beta.messages.create({
    model: MODEL,
    max_tokens: 6000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: EFFORT, format: { type: "json_schema", schema } },
    system,
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal") throw new Error("Claude declined this step.");
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return { data: JSON.parse(text) as T, tokens: res.usage.input_tokens + res.usage.output_tokens };
}

const STEP_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["think", "tool", "observe", "answer"] },
    tool: { type: "string" },
    label: { type: "string" },
    detail: { type: "string" },
    skillStep: { type: "integer" },
    wasted: { type: "boolean" },
  },
  required: ["kind", "tool", "label", "detail", "skillStep", "wasted"],
  additionalProperties: false,
};

/** Run a task in a simulated sandbox: Claude plans the tool calls and invents plausible observations. */
export async function liveRun(req: LiveRunRequest): Promise<LiveRunResponse> {
  const system = [
    "You are a Hermes-style agent running inside a SIMULATED sandbox. No tool is really executed:",
    "you narrate each tool call and write a short, plausible observation for it.",
    "Return 5-10 events. kind: think | tool | observe | answer (exactly one answer, last).",
    "tool = tool name for tool events (e.g. read_file, python, shell, git, github, write_file), else empty string.",
    "label = the call or a 2-5 word heading; detail = one short line (args, observation, or reasoning).",
    "wasted = true only for a dead end you back out of.",
    "skillStep = 1-based index of the loaded skill's procedure step this event follows, or 0 if none / no skill.",
    "If a skill is loaded, follow its procedure and avoid its pitfalls. outcome = one sentence result.",
  ].join("\n");
  const user = [
    `Task: ${req.prompt}`,
    req.skill ? `Loaded skill (SKILL.md):\n${skillToMarkdown(req.skill)}` : "No skill loaded: cold start.",
  ].join("\n\n");
  const { data, tokens } = await json<{ steps: (Omit<RunStep, "tokens"> & { skillStep: number })[]; outcome: string }>(
    system,
    user,
    {
      type: "object",
      properties: { steps: { type: "array", items: STEP_SCHEMA }, outcome: { type: "string" } },
      required: ["steps", "outcome"],
      additionalProperties: false,
    },
  );
  const per = Math.round(tokens / Math.max(1, data.steps.length));
  const steps: RunStep[] = data.steps.map((s) => ({
    kind: s.kind,
    label: s.label,
    detail: s.detail,
    tool: s.tool || undefined,
    skillStep: req.skill && s.skillStep > 0 ? s.skillStep : undefined,
    wasted: s.wasted || undefined,
    tokens: per,
  }));
  if (req.skill) {
    steps.unshift({ kind: "skill", label: `Loaded skill: ${req.skill.name}`, detail: req.skill.trigger, tokens: 0 });
  }
  return { steps, outcome: data.outcome, tokens };
}

/** Distil a reusable skill from a finished run, Hermes-style. */
export async function liveExtract(req: LiveExtractRequest): Promise<LiveExtractResponse> {
  const system = [
    "You distil reusable skills from finished agent runs, like Hermes Agent's procedural memory.",
    "Write a skill that would let an agent solve a RELATED task faster next time.",
    "name: kebab-case, 2-4 words. description: one sentence. trigger: when to load it (one sentence).",
    "tools: tool names used. steps: 3-6 imperative procedure steps from the successful path.",
    "pitfalls: 1-3 lessons from dead ends (or generic cautions if there were none).",
  ].join("\n");
  const transcript = req.steps
    .map((s, i) => `${i + 1}. [${s.kind}${s.tool ? `:${s.tool}` : ""}${s.wasted ? " DEAD-END" : ""}] ${s.label} — ${s.detail}`)
    .join("\n");
  const { data, tokens } = await json<LiveExtractResponse["skill"]>(
    system,
    `Task: ${req.prompt}\n\nRun:\n${transcript}\n\nOutcome: ${req.outcome}`,
    {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        trigger: { type: "string" },
        tools: { type: "array", items: { type: "string" } },
        steps: { type: "array", items: { type: "string" } },
        pitfalls: { type: "array", items: { type: "string" } },
      },
      required: ["name", "description", "trigger", "tools", "steps", "pitfalls"],
      additionalProperties: false,
    },
  );
  return { skill: data, tokens };
}
