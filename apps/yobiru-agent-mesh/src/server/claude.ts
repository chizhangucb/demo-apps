import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Same env names as apps/claude-agent-loops. Read server-side only.
export const MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5-5";

/** Hard caps: a run makes at most 3 live calls, each with a small output budget. */
export const MAX_CALLS_PER_RUN = 3;
const MAX_TOKENS = 1500;

export function liveAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function client() {
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  return new Anthropic(workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : undefined);
}

const ROLE: Record<string, string> = {
  running: "You are codex on home-mac. Write a one sentence progress note to grokbot: you started triage of 3 bugs and are sending BUG-101 (high severity, coupon doubles shipping) to claude@tokyo-server for a repro.",
  repro_reply: "You are claude on tokyo-server. Write a two sentence reply to codex: you reproduced BUG-101 on shop-web@main (re-applying SAVE10 gives 46.00 instead of 41.00) and attached repro.json with steps, a failing test and the root cause.",
  summary: "You are codex on home-mac. Write a two sentence final summary to grokbot: BUG-101 was reproduced by claude@tokyo-server, root cause is applyCoupon() adding shipping on every apply, fix is to compute shipping in totals(); BUG-102 and BUG-103 are queued.",
};

export async function liveText(slot: string): Promise<{ text: string; tokens: number }> {
  const role = ROLE[slot];
  if (!role) throw new Error(`unknown slot ${slot}`);
  const res = await client().beta.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: "You write short agent-to-agent messages for a simulated demo. Plain text, no markdown, under 50 words. Do not use em dashes or en dashes.",
    messages: [{ role: "user", content: role }],
  });
  if (res.stop_reason === "refusal") throw new Error("declined");
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
  if (!text) throw new Error("empty reply");
  return { text: text.replace(/[\u2013\u2014]/g, ","), tokens: res.usage.input_tokens + res.usage.output_tokens };
}
