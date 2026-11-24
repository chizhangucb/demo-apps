import { describe, expect, test } from "bun:test";
import { CHUNK_LEN, FAST_TOKENS, REST, armTarget, ik, simStateAt, totalDuration } from "../src/lib/sim";

describe("simulation state", () => {
  test("FAST reveals tokens one by one before any chunk appears", () => {
    const a = simStateAt("fast", 300);
    const b = simStateAt("fast", 1200);
    expect(a.phase).toBe("tokens");
    expect(a.tokensShown).toBeLessThan(b.tokensShown);
    expect(b.chunkShown).toBe(0);
    const d = simStateAt("fast", 2200);
    expect(d.phase).toBe("decode");
    expect(d.tokensShown).toBe(FAST_TOKENS);
  });
  test("OFT shows the whole chunk at once", () => {
    expect(simStateAt("oft", 300).chunkShown).toBe(0);
    const s = simStateAt("oft", 700);
    expect(s.phase).toBe("parallel");
    expect(s.chunkShown).toBe(CHUNK_LEN);
    expect(s.tokensShown).toBe(0);
  });
  test("PI noise decreases monotonically over denoise steps", () => {
    const n = [100, 600, 1100, 1600, 2100].map((t) => simStateAt("pi", t).noise);
    for (let i = 1; i < n.length; i++) expect(n[i]).toBeLessThanOrEqual(n[i - 1]);
    expect(n[0]).toBeGreaterThan(0);
    expect(simStateAt("pi", 2150).denoiseStep).toBe(5);
  });
  test("GR00T has a System 2 plan beat before System 1 denoising", () => {
    const p = simStateAt("gr00t", 500);
    expect(p.phase).toBe("plan");
    expect(p.planShown).toBe(true);
    expect(p.chunkShown).toBe(0);
    const d = simStateAt("gr00t", 1300);
    expect(d.phase).toBe("denoise");
    expect(d.planShown).toBe(true);
  });
  test("every head ends executing the chunk, then done", () => {
    for (const h of ["fast", "oft", "pi", "gr00t"] as const) {
      const end = simStateAt(h, totalDuration(h) + 10);
      expect(end.phase).toBe("done");
      expect(end.armProgress).toBe(CHUNK_LEN - 1);
      expect(simStateAt(h, totalDuration(h) - 1000).phase).toBe("execute");
    }
  });
  test("arm rests when progress is negative and IK reaches targets", () => {
    expect(armTarget(-1)).toEqual(REST);
    const [s, e] = ik(0.6, 0.3);
    const x = 0.18 + 0.36 * Math.cos(s) + 0.32 * Math.cos(s + e);
    const y = 0.12 + 0.36 * Math.sin(s) + 0.32 * Math.sin(s + e);
    expect(x).toBeCloseTo(0.6, 4);
    expect(y).toBeCloseTo(0.3, 4);
  });
});
