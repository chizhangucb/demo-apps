import { describe, expect, test } from "bun:test";
import { detectRepetition, lastBoxed } from "@/lib/text";
import { clampTokens, isSpaceUnavailableText, validateProblem, MAX_PROBLEM_CHARS } from "@/lib/live";

describe("repetition detection", () => {
  test("flags exact repeated long lines only", () => {
    const L = "Wait, let me re-check the conversion of the angle once again.";
    const r = detectRepetition(`intro\n${L}\nshort\n${L}\n${L}\nend`);
    expect(r.repeatedLines).toBe(2);
    expect(r.totalLines).toBe(3);
    expect(r.segments.map((s) => s.repeat)).toEqual([false, true, false]);
    expect(r.segments.map((s) => s.text).join("")).toBe(`intro\n${L}\nshort\n${L}\n${L}\nend`);
    expect(r.firstRepeatChar).toBe(`intro\n${L}\nshort\n`.length);
  });
  test("no repeats", () => {
    expect(detectRepetition("a\nb\nc").repeatedLines).toBe(0);
  });
});

describe("boxed", () => {
  test("balanced last boxed", () => {
    expect(lastBoxed("x \\boxed{1} y \\boxed{\\frac{1}{2}}")).toBe("\\frac{1}{2}");
    expect(lastBoxed("none")).toBeNull();
  });
});

describe("live guards", () => {
  test("token clamp", () => {
    expect(clampTokens(99999)).toBe(2048);
    expect(clampTokens("x")).toBe(1024);
    expect(clampTokens(1500)).toBe(1500);
  });
  test("problem validation", () => {
    expect(validateProblem("").ok).toBe(false);
    expect(validateProblem("x".repeat(MAX_PROBLEM_CHARS + 1)).ok).toBe(false);
    expect(validateProblem(" 2+2 ").ok).toBe(true);
  });
  test("recognises the Space quota message", () => {
    expect(isSpaceUnavailableText("Live generation isn't available on this Space's current hardware ('The requested GPU duration (450s) is larger than the maximum allowed")).toBe(true);
    expect(isSpaceUnavailableText("Let me compute 2+3 = 5. \\boxed{5}")).toBe(false);
  });
});
