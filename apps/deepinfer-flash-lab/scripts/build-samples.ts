// Records the SAMPLE mode data from real calls to DeepSeek-V4.1-Flash via
// OpenRouter: every chat preset with thinking off and with thinking on, and
// every structured output preset. It stores the streamed text exactly as it
// arrived plus the measured gap before each chunk, so SAMPLE mode replays the
// real stream at its real pace. Writes data/samples/chat.json and
// data/samples/structured.json.
// Run: OPENROUTER_API_KEY=... bun run samples

import { CHAT_PRESETS, STRUCTURED_PRESETS } from "../data/samples/prompts";
import { createSSEParser, parseChatChunk } from "../src/lib/sse";
import { OPENROUTER_DEFAULT_MODEL, OPENROUTER_URL } from "../src/lib/mode";
import { validateJson } from "../src/lib/validate";
import { structuredMessages } from "../src/lib/structured-prompt";

// Same limits and request shapes as src/server/provider.ts.
const MAX_TOKENS = 800;
const key = process.env.OPENROUTER_API_KEY?.trim();
if (!key) throw new Error("OPENROUTER_API_KEY is not set");
const model = process.env.OPENROUTER_MODEL?.trim() || OPENROUTER_DEFAULT_MODEL;
const headers = { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Title": "DeepInfer Flash Lab" };

type Kind = "reasoning" | "content";
export type RecordedRun = {
  ttftMs: number;
  totalMs: number;
  completionTokens: number | null;
  chunks: [Kind, string, number][];
};

async function recordChat(prompt: string, thinking: boolean): Promise<RecordedRun> {
  const t0 = performance.now();
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: MAX_TOKENS,
      reasoning: { enabled: thinking },
    }),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const parser = createSSEParser();
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  const chunks: [Kind, string, number][] = [];
  let ttftMs = -1;
  let last = 0;
  let usage: number | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    const now = performance.now();
    for (const data of done ? parser.flush() : parser.push(value)) {
      const d = parseChatChunk(data);
      if (!d) continue;
      for (const kind of ["reasoning", "content"] as const) {
        const text = d[kind];
        if (!text) continue;
        if (ttftMs < 0) {
          ttftMs = Math.round(now - t0);
          last = now;
        }
        chunks.push([kind, text, Math.round(now - last)]);
        last = now;
      }
      if (d.completionTokens !== undefined) usage = d.completionTokens;
    }
    if (done) break;
  }
  return { ttftMs, totalMs: Math.round(performance.now() - t0), completionTokens: usage, chunks };
}

async function recordStructured(schema: object, messages: unknown) {
  const t0 = performance.now();
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      max_tokens: MAX_TOKENS,
      stream: false,
      response_format: { type: "json_schema", json_schema: { name: "lab_output", strict: true, schema } },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
  return { raw: json.choices?.[0]?.message?.content ?? "", latencyMs: Math.round(performance.now() - t0) };
}

function summary(r: RecordedRun) {
  const content = r.chunks.filter((c) => c[0] === "content").length;
  const reasoning = r.chunks.filter((c) => c[0] === "reasoning").length;
  const tps = r.completionTokens ? (r.completionTokens / ((r.totalMs - r.ttftMs) / 1000)).toFixed(1) : "n/a";
  return `ttft ${r.ttftMs} ms, total ${r.totalMs} ms, tokens ${r.completionTokens}, ${tps} tok/s, chunks ${reasoning} reasoning + ${content} content`;
}

const recordedAt = new Date().toISOString();
const chat: Record<string, { off: RecordedRun; on: RecordedRun }> = {};
for (const p of CHAT_PRESETS) {
  const off = await recordChat(p.prompt, false);
  console.log(`${p.id} thinking off: ${summary(off)}`);
  const on = await recordChat(p.prompt, true);
  console.log(`${p.id} thinking on: ${summary(on)}`);
  chat[p.id] = { off, on };
}

const structured: Record<string, { raw: string; latencyMs: number; valid: boolean }> = {};
for (const s of STRUCTURED_PRESETS) {
  const r = await recordStructured(s.schema, structuredMessages(s.schema, s.prompt));
  const v = validateJson(s.schema, r.raw);
  console.log(`${s.id}: ${r.latencyMs} ms round trip, schema ${v.valid ? "PASS" : "FAIL"}`);
  structured[s.id] = { ...r, valid: v.valid };
}

const meta = { model, provider: "OpenRouter", recordedAt };
await Bun.write(new URL("../data/samples/chat.json", import.meta.url), JSON.stringify({ meta, runs: chat }) + "\n");
await Bun.write(new URL("../data/samples/structured.json", import.meta.url), JSON.stringify({ meta, runs: structured }, null, 2) + "\n");
console.log("wrote data/samples/chat.json and data/samples/structured.json at", recordedAt);
