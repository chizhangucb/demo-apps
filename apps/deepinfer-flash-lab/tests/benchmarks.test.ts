import { describe, expect, test } from "bun:test";
import * as B from "../data/benchmarks";

const isUrl = (s: unknown) => typeof s === "string" && /^https:\/\/\S+$/.test(s);

describe("benchmark data", () => {
  test("every entry has a source URL", () => {
    const lists = [B.DECODE_POINTS, B.PREFILL_POINTS, B.VERIFY_TABLE, B.HEADLINE_FACTS, B.EVAL_RESULTS, B.PRICING, B.FEATURES];
    for (const list of lists) {
      expect(list.length).toBeGreaterThan(0);
      for (const entry of list) expect(isUrl(entry.source)).toBe(true);
    }
    for (const s of Object.values(B.SOURCES)) expect(isUrl(s.url)).toBe(true);
  });

  test("chart readings are flagged approximate", () => {
    for (const p of [...B.DECODE_POINTS, ...B.PREFILL_POINTS]) expect(p.approx).toBe(true);
  });

  test("verification table matches the six published rows", () => {
    expect(B.VERIFY_TABLE.map((r) => r.concurrency)).toEqual([16, 32, 48, 60, 72, 96]);
    expect(B.VERIFY_TABLE.find((r) => r.concurrency === 60)?.gain).toBe("+5.4%");
  });
});
