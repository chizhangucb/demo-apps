// SAMPLE mode data: the preset prompts and schemas from prompts.ts joined to
// real responses recorded from DeepSeek-V4.1-Flash via OpenRouter on
// Oct 22, 2026 (chat.json and structured.json, written by
// scripts/build-samples.ts). The text is the model output exactly as it
// streamed, and the chunk gaps are the measured gaps from that run.

import chat from "./chat.json";
import structured from "./structured.json";
import { CHAT_PRESETS as CHAT_PROMPTS, STRUCTURED_PRESETS as STRUCTURED_PROMPTS, type ChatPrompt, type StructuredPrompt } from "./prompts";

export const SAMPLE_RECORDING = "recorded from DeepSeek-V4.1-Flash via OpenRouter on Oct 22, 2026";

export type RecordedRun = {
  ttftMs: number;
  totalMs: number;
  completionTokens: number | null;
  chunks: ["reasoning" | "content", string, number][];
};

export const RECORDED_RUNS = (chat as unknown as { runs: Record<string, { off: RecordedRun; on: RecordedRun }> }).runs;
const STRUCTURED_RUNS = (structured as { runs: Record<string, { raw: string; latencyMs: number }> }).runs;

const textOf = (run: RecordedRun, kind: "reasoning" | "content") =>
  run.chunks.flatMap(([k, t]) => (k === kind ? [t] : [])).join("");

export type ChatPreset = ChatPrompt & { reasoning: string; answer: string };

// answer is the thinking off run; reasoning is the thinking on run's trace.
export const CHAT_PRESETS: ChatPreset[] = CHAT_PROMPTS.map((p) => ({
  ...p,
  answer: textOf(RECORDED_RUNS[p.id].off, "content"),
  reasoning: textOf(RECORDED_RUNS[p.id].on, "reasoning"),
}));

export type StructuredPreset = StructuredPrompt & { sampleOutput: object; sampleRaw: string; sampleLatencyMs: number };

export const STRUCTURED_PRESETS: StructuredPreset[] = STRUCTURED_PROMPTS.map((p) => ({
  ...p,
  sampleRaw: STRUCTURED_RUNS[p.id].raw,
  sampleOutput: JSON.parse(STRUCTURED_RUNS[p.id].raw) as object,
  sampleLatencyMs: STRUCTURED_RUNS[p.id].latencyMs,
}));
