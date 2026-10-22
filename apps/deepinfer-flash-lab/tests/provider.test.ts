import { describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));
const { runChat, exampleFor } = await import("../src/server/provider");
import { CHAT_PRESETS } from "../data/samples/presets";

describe("provider", () => {
  test("SAMPLE replay streams the preset answer with usage", async () => {
    const p = CHAT_PRESETS[1];
    const events = [];
    for await (const ev of runChat({}, { prompt: p.prompt, presetId: p.id, thinking: false }, new AbortController().signal)) events.push(ev);
    expect(events[0]).toMatchObject({ type: "meta", sample: true });
    const text = events.flatMap((e) => (e.type === "delta" ? [e.text] : [])).join("");
    expect(text).toBe(p.answer);
    expect(events.at(-1)).toEqual({ type: "done" });
    expect(events.some((e) => e.type === "usage")).toBe(true);
  }, 20000);

  test("builds a schema example for the JSON mode prompt", () => {
    expect(exampleFor({ type: "object", properties: { c: { enum: ["red"] }, n: { type: "integer", minimum: 1 }, t: { type: "array", items: { type: "string" } } } })).toEqual({ c: "red", n: 1, t: ["..."] });
  });
});
