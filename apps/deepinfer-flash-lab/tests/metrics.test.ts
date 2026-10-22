import { describe, expect, test } from "bun:test";
import { computeRunMetrics, estimateTokens, tokensPerSecond, ttft, windowRate } from "../src/lib/metrics";

describe("speed and latency math", () => {
  test("TTFT is first token minus start", () => {
    expect(ttft(1000, 1450)).toBe(450);
    expect(ttft(1000, null)).toBeNull();
  });

  test("tokens/s uses only the time after the first token", () => {
    expect(tokensPerSecond(100, 500, 2500)).toBe(50);
    expect(tokensPerSecond(0, 500, 2500)).toBeNull();
    expect(tokensPerSecond(10, 500, 500)).toBeNull();
    expect(tokensPerSecond(10, null, 500)).toBeNull();
  });

  test("prefers provider usage and flags estimates otherwise", () => {
    const withUsage = computeRunMetrics({ startMs: 0, firstTokenMs: 400, endMs: 2400, usageTokens: 120, text: "x".repeat(40) });
    expect(withUsage).toEqual({ ttftMs: 400, totalMs: 2400, tokens: 120, tokensEstimated: false, tokensPerSec: 60 });
    const est = computeRunMetrics({ startMs: 0, firstTokenMs: 400, endMs: 1400, usageTokens: null, text: "x".repeat(400) });
    expect(est.tokens).toBe(100);
    expect(est.tokensEstimated).toBe(true);
    expect(est.tokensPerSec).toBe(100);
  });

  test("estimate and rolling window", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("ab")).toBe(1);
    const marks = [{ t: 100, n: 1 }, { t: 600, n: 2 }, { t: 900, n: 3 }];
    expect(windowRate(marks, 1000, 1000)).toBe(6);
    expect(windowRate(marks, 1000, 500)).toBe(10);
  });
});
