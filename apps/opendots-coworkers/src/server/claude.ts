import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { LiveWriter } from "./agent";

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

const SYSTEM = `You are the Writer Dot, an AI coworker. Turn the Researcher's findings into a short one-page
document in Markdown: "## " section headings and "- " bullets only, under 180 words, no title line
(the title is set separately). Use only the findings you are given; do not invent sources.`;

/** Live path: Claude writes the page body. Tool calls stay simulated and gated by the same server check. */
export const liveWriter: LiveWriter = async function* (task, findings) {
  const stream = client().messages.stream({
    model: MODEL,
    max_tokens: 1500,
    output_config: { effort: EFFORT },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Task: ${task.prompt}\n\nFindings:\n${findings
          .map((f) => `- ${f.title}: ${f.detail}${f.source ? ` (${f.source})` : " (no source)"}`)
          .join("\n")}`,
      },
    ],
  });
  for await (const ev of stream) {
    if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") yield ev.delta.text;
  }
};
