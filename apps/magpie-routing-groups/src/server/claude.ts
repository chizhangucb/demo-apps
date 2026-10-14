import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Same env names as apps/claude-agent-loops. Read server-side only.
export const MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5-5";
const EFFORT = (process.env.ANTHROPIC_EFFORT?.trim() || "low") as "low" | "medium" | "high";

/** Hard caps: a run makes at most 3 live calls, each with a small output budget. */
export const MAX_CALLS_PER_RUN = 3;
const MAX_TOKENS = 600;

export function liveAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function client() {
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  return new Anthropic(workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : undefined);
}

export async function liveReply(agent: string, prompt: string, servedAs: string): Promise<{ text: string; tokens: number }> {
  const res = await client().beta.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: EFFORT },
    system:
      "You play a model answering one turn of a coding agent in a simulated routing demo. There is no real repository. " +
      "Answer in at most two short sentences of plain text, no markdown. Do not use em dashes or en dashes.",
    messages: [{ role: "user", content: `Agent: ${agent}. Routed to: ${servedAs}. Turn: ${prompt.slice(0, 200)}` }],
  });
  if (res.stop_reason === "refusal") throw new Error("declined");
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
  if (!text) throw new Error("empty reply");
  return { text: text.replace(/[\u2013\u2014]/g, ","), tokens: res.usage.input_tokens + res.usage.output_tokens };
}
