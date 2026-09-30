import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type {
  LiveActRequest,
  LiveActResponse,
  LiveJudgeRequest,
  LiveJudgeResponse,
} from "@/lib/types";

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
    max_tokens: 4000,
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

const LOOP_HINT: Record<LiveActRequest["loopType"], string> = {
  turn: "You are in a turn loop: set done=true when you believe the task is finished.",
  goal: "You are in a goal loop: an external verifier checks your output against the criteria after every turn.",
  time: "You are in a time loop: you are woken on an interval to re-check the world. Report the current state honestly; do not invent progress the observation does not show.",
  proactive: "You are in a proactive loop: you were woken by the trigger below. Act only if the trigger warrants it; otherwise say no action is needed.",
};

export async function liveAct(req: LiveActRequest): Promise<LiveActResponse> {
  const system = [
    "You are the Act step of a small agent-loop demo. Each call is one turn.",
    LOOP_HINT[req.loopType],
    "Return JSON: act = one sentence describing what you did this turn; output = the artifact itself (plain text, a few short lines); done = whether you consider the task finished.",
    "Only use facts from the goal, observation, and trigger. Keep output under 60 words.",
  ].join("\n");
  const user = [
    `Goal: ${req.goal}`,
    `Verification criteria:\n${req.criteria.map((c) => `- ${c}`).join("\n")}`,
    `Turn: ${req.turn}`,
    req.trigger && `Trigger: ${req.trigger}`,
    req.observation && `Observation: ${req.observation}`,
    req.previousOutput && `Your previous output:\n${req.previousOutput}`,
    req.feedback && `Verifier feedback on it:\n${req.feedback}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const { data, tokens } = await json<{ act: string; output: string; done: boolean }>(system, user, {
    type: "object",
    properties: { act: { type: "string" }, output: { type: "string" }, done: { type: "boolean" } },
    required: ["act", "output", "done"],
    additionalProperties: false,
  });
  return { act: data.act, output: data.output, agentDone: data.done, tokens };
}

export async function liveJudge(req: LiveJudgeRequest): Promise<LiveJudgeResponse> {
  const system =
    "You are the Evaluate step of an agent loop: a strict verifier. For each criterion, decide pass/fail for the output and give a note of at most 12 words.";
  const user = `Goal: ${req.goal}\n\nOutput:\n${req.output}\n\nCriteria:\n${req.criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}`;
  const { data, tokens } = await json<{ results: { criterion: string; pass: boolean; note: string }[] }>(system, user, {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: { criterion: { type: "string" }, pass: { type: "boolean" }, note: { type: "string" } },
          required: ["criterion", "pass", "note"],
          additionalProperties: false,
        },
      },
    },
    required: ["results"],
    additionalProperties: false,
  });
  return { results: data.results, tokens };
}
