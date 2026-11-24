import { describe, expect, test } from "bun:test";
import { LIMITS, liveStateAt, liveTimeline, validateSpec } from "@/lib/modelspec";

const prim = (material = "shell") => ({ shape: "box", size: [1, 0.5, 0.5], pos: [0, 0, 0], rot: [0, 0, 0], material });
const part = (label: string) => ({ id: label.toLowerCase(), label, note: `${label} note`, anchor: [0.5, 0.2, 0], explode: [0, 1, 0], primitives: [prim(), prim("accent")] });
const checklist = Array.from({ length: 11 }, (_, i) => ({ item: `check ${i}`, grade: ["yes", "partial", "no"][i % 3] }));
const good = () => ({ name: "Corvane", code: "RX-4", kind: "Robotic beetle", parts: ["Optics", "Shell", "Legs", "Core"].map(part), checklist, simplified: "Legs are cylinders." });

describe("validateSpec", () => {
  test("accepts a well-formed spec", () => {
    const v = validateSpec(good());
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.spec.parts.length).toBe(4);
      expect(v.spec.checklist.length).toBe(11);
    }
  });
  test("rejects non-objects and too few parts", () => {
    expect(validateSpec("nope").ok).toBe(false);
    expect(validateSpec([]).ok).toBe(false);
    const g = good();
    g.parts = g.parts.slice(0, 3);
    const v = validateSpec(g);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors.join(" ")).toContain("at least 4 parts");
  });
  test("rejects a short checklist and bad vectors", () => {
    const g = good();
    g.checklist = checklist.slice(0, 5);
    expect(validateSpec(g).ok).toBe(false);
    const h = good() as Record<string, unknown> & { parts: Record<string, unknown>[] };
    h.parts[0].anchor = [1, 2];
    expect(validateSpec(h).ok).toBe(false);
  });
  test("clamps numbers, defaults unknown materials, truncates extras", () => {
    const g = good() as ReturnType<typeof good> & { parts: ReturnType<typeof part>[] };
    g.parts[0].primitives[0] = { ...prim("chrome"), size: [99, 0, 1], pos: [-50, 0, 0] };
    g.parts = [...g.parts, ...["A", "B", "C", "D", "E", "F"].map(part)];
    const v = validateSpec(g);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const p = v.spec.parts[0].primitives[0];
    expect(p.material).toBe("shell");
    expect(p.size).toEqual([LIMITS.maxSize, LIMITS.minSize, 1]);
    expect(p.pos[0]).toBe(-LIMITS.extent);
    expect(v.spec.parts.length).toBe(LIMITS.maxParts);
    expect(v.warnings.length).toBeGreaterThan(0);
  });
  test("skips unknown shapes and dedupes ids", () => {
    const g = good() as ReturnType<typeof good> & { parts: ReturnType<typeof part>[] };
    g.parts[0].primitives.push({ ...prim(), shape: "teapot" });
    g.parts[1].id = g.parts[0].id;
    const v = validateSpec(g);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.spec.parts[0].primitives.length).toBe(2);
    expect(new Set(v.spec.parts.map((p) => p.id)).size).toBe(4);
  });
  test("strips control characters and caps text", () => {
    const g = good();
    g.name = "Cor\u0007vane".padEnd(200, "x");
    const v = validateSpec(g);
    expect(v.ok && v.spec.name.length).toBe(40);
    expect(v.ok && v.spec.name.includes("\u0007")).toBe(false);
  });
});

describe("live explode and reassemble state", () => {
  const v = validateSpec(good());
  if (!v.ok) throw new Error("fixture");
  const tl = liveTimeline(v.spec);
  test("one beat per part, then explode, assemble and hero", () => {
    expect(tl.script.map((b) => b.act)).toEqual(["optics", "shell", "legs", "core", "exploded", "assemble", "hero"]);
  });
  test("a part opens on its beat and closes again", () => {
    const b = tl.script[0];
    expect(liveStateAt(tl, b.t).open.optics).toBe(0);
    expect(liveStateAt(tl, b.t + 1.5).open.optics).toBeCloseTo(1);
    expect(liveStateAt(tl, b.t + 2.6).open.optics).toBe(0);
  });
  test("whole at rest, apart after the explode, whole again after the reassembly", () => {
    const ex = tl.script.find((b) => b.act === "exploded")!.t;
    const as = tl.script.find((b) => b.act === "assemble")!.t;
    expect(liveStateAt(tl, ex - 0.5).explode).toBe(0);
    expect(liveStateAt(tl, ex + 2).explode).toBeCloseTo(1);
    expect(liveStateAt(tl, as + 1.2).explode).toBe(0);
    expect(liveStateAt(tl, tl.duration).turn).toBeCloseTo(360);
  });
  test("idle and single-part timelines have no explode and stay finite", () => {
    const idle = liveStateAt({ duration: 10, script: [] }, 5);
    expect(idle.explode).toBe(0);
    expect(idle.turn).toBe(0);
    const one = liveStateAt({ duration: 10, script: [{ t: 2, act: "legs" }] }, 3.5);
    expect(one.explode).toBe(0);
    expect(one.open.legs).toBeCloseTo(1);
  });
});
