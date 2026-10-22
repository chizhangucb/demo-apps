import "server-only";

import chatTracks from "../../data/samples/chat.json";
import { CHAT_PRESETS, STRUCTURED_PRESETS, type StructuredPreset } from "../../data/samples/presets";
import { resolveProvider, type ModeInfo, type ProviderConfig, SAMPLE_MODE } from "@/lib/mode";
import { createSSEParser, parseChatChunk } from "@/lib/sse";

export const CHAT_MAX_TOKENS = 800;
export const STRUCTURED_MAX_TOKENS = 800;
export const FIRST_BYTE_TIMEOUT_MS = 20_000;
export const STREAM_TIMEOUT_MS = 60_000;
export const STRUCTURED_TIMEOUT_MS = 30_000;
export const MAX_PROMPT_CHARS = 4000;

export type LabEvent =
  | { type: "meta"; info: ModeInfo; sample: boolean; note?: string }
  | { type: "delta"; kind: "reasoning" | "content"; text: string }
  | { type: "usage"; completionTokens: number }
  | { type: "error"; message: string }
  | { type: "done" };

type Track = { ttftMs: number; chunks: [string, number][] };
const TRACKS = chatTracks as unknown as Record<string, { reasoning: Track; answer: Track }>;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });

export function pickChatPreset(presetId: string | undefined, prompt: string) {
  return (
    CHAT_PRESETS.find((p) => p.id === presetId && p.prompt === prompt) ??
    CHAT_PRESETS.find((p) => p.prompt === prompt) ??
    null
  );
}

// Replays a recorded sample, chunk by chunk, with its recorded delays.
async function* replaySample(presetId: string, thinking: boolean, signal: AbortSignal): AsyncGenerator<LabEvent> {
  const t = TRACKS[presetId] ?? TRACKS[CHAT_PRESETS[0].id];
  let tokens = 0;
  if (thinking) {
    await sleep(t.reasoning.ttftMs, signal);
    for (const [text, d] of t.reasoning.chunks) {
      if (signal.aborted) return;
      yield { type: "delta", kind: "reasoning", text };
      tokens++;
      await sleep(d, signal);
    }
    await sleep(120, signal);
  } else {
    await sleep(t.answer.ttftMs, signal);
  }
  for (const [text, d] of t.answer.chunks) {
    if (signal.aborted) return;
    yield { type: "delta", kind: "content", text };
    tokens++;
    await sleep(d, signal);
  }
  yield { type: "usage", completionTokens: tokens };
}

function chatBody(p: ProviderConfig, prompt: string, thinking: boolean) {
  const base = {
    model: p.model,
    messages: [{ role: "user", content: prompt }],
    stream: true,
    stream_options: { include_usage: true },
    max_tokens: CHAT_MAX_TOKENS,
  };
  if (p.mode === "deepseek") return { ...base, thinking: { type: thinking ? "enabled" : "disabled" } };
  return { ...base, reasoning: { enabled: thinking } };
}

function headers(p: ProviderConfig) {
  const h: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` };
  if (p.mode === "openrouter") h["X-Title"] = "DeepInfer Flash Lab";
  return h;
}

async function* streamLive(p: ProviderConfig, prompt: string, thinking: boolean, signal: AbortSignal): AsyncGenerator<LabEvent> {
  const ctrl = new AbortController();
  const total = setTimeout(() => ctrl.abort(new Error("stream timeout")), STREAM_TIMEOUT_MS);
  const firstByte = setTimeout(() => ctrl.abort(new Error("no response within 20 s")), FIRST_BYTE_TIMEOUT_MS);
  signal.addEventListener("abort", () => ctrl.abort());
  try {
    const res = await fetch(p.url, {
      method: "POST",
      headers: headers(p),
      body: JSON.stringify(chatBody(p, prompt, thinking)),
      signal: ctrl.signal,
    });
    clearTimeout(firstByte);
    if (!res.ok || !res.body) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      throw new Error(`HTTP ${res.status} ${detail}`.trim());
    }
    const parser = createSSEParser();
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let usage: number | null = null;
    for (;;) {
      const { value, done } = await reader.read();
      const payloads = done ? parser.flush() : parser.push(value);
      for (const data of payloads) {
        const d = parseChatChunk(data);
        if (!d) continue;
        if (d.reasoning) yield { type: "delta", kind: "reasoning", text: d.reasoning };
        if (d.content) yield { type: "delta", kind: "content", text: d.content };
        if (d.completionTokens !== undefined) usage = d.completionTokens;
      }
      if (done) break;
    }
    if (usage !== null) yield { type: "usage", completionTokens: usage };
  } finally {
    clearTimeout(total);
    clearTimeout(firstByte);
  }
}

// One chat run as a stream of LabEvents: live when a key is set, otherwise
// (or when the live call fails before any token) the recorded sample.
export async function* runChat(
  env: Record<string, string | undefined>,
  input: { prompt: string; presetId?: string; thinking: boolean },
  signal: AbortSignal,
): AsyncGenerator<LabEvent> {
  const p = resolveProvider(env);
  const preset = pickChatPreset(input.presetId, input.prompt);
  const fallbackId = preset?.id ?? CHAT_PRESETS[0].id;

  if (!p) {
    const note = preset ? undefined : `Custom prompts need a key. Replaying the "${CHAT_PRESETS[0].title}" sample instead.`;
    yield { type: "meta", info: SAMPLE_MODE, sample: true, note };
    yield* replaySample(fallbackId, input.thinking, signal);
    yield { type: "done" };
    return;
  }

  yield { type: "meta", info: { mode: p.mode, label: p.label, provider: p.provider, model: p.model }, sample: false };
  let emitted = false;
  try {
    for await (const ev of streamLive(p, input.prompt, input.thinking, signal)) {
      emitted = true;
      yield ev;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (signal.aborted) return;
    if (emitted) {
      yield { type: "error", message: `Stream interrupted: ${msg}` };
      yield { type: "done" };
      return;
    }
    yield { type: "meta", info: SAMPLE_MODE, sample: true, note: `Live call failed (${msg}). Fell back to the recorded sample.` };
    yield* replaySample(fallbackId, input.thinking, signal);
  }
  yield { type: "done" };
}

// Build a filled example of the target shape from a schema, since the
// DeepSeek JSON mode docs ask for an example in the prompt.
export function exampleFor(schema: unknown): unknown {
  const s = (schema ?? {}) as Record<string, unknown>;
  if (Array.isArray(s.enum) && s.enum.length) return s.enum[0];
  switch (s.type) {
    case "object": {
      const props = (s.properties ?? {}) as Record<string, unknown>;
      return Object.fromEntries(Object.entries(props).map(([k, v]) => [k, exampleFor(v)]));
    }
    case "array":
      return [exampleFor(s.items)];
    case "integer":
    case "number":
      return typeof s.minimum === "number" ? s.minimum : 1;
    case "boolean":
      return true;
    case "string":
      return "...";
    default:
      return null;
  }
}

export function structuredMessages(schema: object, prompt: string) {
  return [
    {
      role: "system",
      content:
        "Reply with a single json object only, no prose. It must conform to this JSON schema:\n" +
        JSON.stringify(schema) +
        "\nExample json output shape:\n" +
        JSON.stringify(exampleFor(schema)),
    },
    { role: "user", content: prompt },
  ];
}

export type StructuredResult = {
  info: ModeInfo;
  sample: boolean;
  note?: string;
  raw: string;
};

export async function runStructured(
  env: Record<string, string | undefined>,
  input: { presetId?: string; schema: object; prompt: string },
): Promise<StructuredResult> {
  const preset: StructuredPreset =
    STRUCTURED_PRESETS.find((s) => s.id === input.presetId) ?? STRUCTURED_PRESETS[0];
  const sample = async (note?: string): Promise<StructuredResult> => {
    await sleep(preset.sampleLatencyMs);
    return { info: SAMPLE_MODE, sample: true, note, raw: JSON.stringify(preset.sampleOutput, null, 2) };
  };

  const p = resolveProvider(env);
  if (!p) return sample();

  const body: Record<string, unknown> = {
    model: p.model,
    messages: structuredMessages(input.schema, input.prompt),
    max_tokens: STRUCTURED_MAX_TOKENS,
    stream: false,
  };
  if (p.mode === "deepseek") {
    body.response_format = { type: "json_object" };
    body.thinking = { type: "disabled" };
  } else {
    body.response_format = { type: "json_schema", json_schema: { name: "lab_output", strict: true, schema: input.schema } };
  }
  try {
    const res = await fetch(p.url, {
      method: "POST",
      headers: headers(p),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(STRUCTURED_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const info = { mode: p.mode, label: p.label, provider: p.provider, model: p.model };
    if (!raw.trim()) return { info, sample: false, raw: "", note: "The API returned empty content (its docs say this can happen)." };
    return { info, sample: false, raw };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return sample(`Live call failed (${msg}). Showing the recorded sample.`);
  }
}
