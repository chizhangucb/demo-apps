import { describe, expect, test } from "bun:test";
import chat from "../data/samples/chat.json";
import structured from "../data/samples/structured.json";
import { CHAT_PRESETS, RECORDED_RUNS, STRUCTURED_PRESETS } from "../data/samples/presets";

describe("recorded samples", () => {
  test("come from DeepSeek-V4.1-Flash via OpenRouter", () => {
    for (const m of [chat.meta, structured.meta]) {
      expect(m.model).toBe("deepseek/deepseek-v4.1-flash");
      expect(m.provider).toBe("OpenRouter");
      expect(m.recordedAt.startsWith("2026-10-22")).toBe(true);
    }
  });

  test("every chat preset has a thinking off and a thinking on run with real timings", () => {
    for (const p of CHAT_PRESETS) {
      const r = RECORDED_RUNS[p.id];
      expect(p.answer.length).toBeGreaterThan(0);
      for (const run of [r.off, r.on]) {
        expect(run.ttftMs).toBeGreaterThan(0);
        expect(run.totalMs).toBeGreaterThan(run.ttftMs);
        expect(run.chunks.length).toBeGreaterThan(0);
      }
      expect(r.on.chunks.some((c) => c[0] === "reasoning")).toBe(true);
    }
  });

  test("every structured preset has a recorded raw output and latency", () => {
    for (const p of STRUCTURED_PRESETS) {
      expect(p.sampleRaw.length).toBeGreaterThan(0);
      expect(p.sampleLatencyMs).toBeGreaterThan(0);
    }
  });
});
