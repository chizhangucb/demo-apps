import { describe, expect, test } from "bun:test";
import { createSSEParser, parseChatChunk } from "../src/lib/sse";

describe("SSE parser", () => {
  test("splits events across arbitrary chunk boundaries", () => {
    const p = createSSEParser();
    const out = [...p.push('data: {"a":'), ...p.push('1}\n\ndata: {"b":2}\n'), ...p.push("\n: keep-alive\n\ndata: [DONE]\n\n")];
    expect(out).toEqual(['{"a":1}', '{"b":2}', "[DONE]"]);
  });

  test("handles CRLF, multi-line data and a trailing event on flush", () => {
    const p = createSSEParser();
    const out = p.push("data: one\r\ndata: two\r\n\r\nevent: x\ndata:three");
    expect(out).toEqual(["one\ntwo"]);
    expect(p.flush()).toEqual(["three"]);
  });

  test("parses OpenAI-format deltas, reasoning and usage", () => {
    expect(parseChatChunk('{"choices":[{"delta":{"content":"Hi"}}]}')).toEqual({ content: "Hi" });
    expect(parseChatChunk('{"choices":[{"delta":{"reasoning_content":"think"}}]}')).toEqual({ reasoning: "think" });
    expect(parseChatChunk('{"choices":[{"delta":{"reasoning":"or-think"}}]}')).toEqual({ reasoning: "or-think" });
    expect(parseChatChunk('{"choices":[],"usage":{"completion_tokens":42}}')).toEqual({ completionTokens: 42 });
    expect(parseChatChunk("[DONE]")).toEqual({ done: true });
    expect(parseChatChunk("not json")).toBeNull();
  });
});
