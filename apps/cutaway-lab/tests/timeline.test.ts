import { describe, expect, test } from "bun:test";
import { beatAt, explodeWindow, parseTimeline } from "@/lib/timeline";
import piranha from "@/vendor/cutaway/sims/piranha-film/timeline.json";
import tarantula from "@/vendor/cutaway/sims/tarantula-film/timeline.json";
import wasp from "@/vendor/cutaway/sims/wasp-film/timeline.json";

describe("parseTimeline", () => {
  test("reads the three vendored film timelines with the PLAN's durations", () => {
    expect(parseTimeline(piranha).duration).toBe(21.2);
    expect(parseTimeline(tarantula).duration).toBe(24.8);
    expect(parseTimeline(wasp).duration).toBe(24.0);
  });
  test("keeps the piranha's camera extras", () => {
    const tl = parseTimeline(piranha);
    expect(tl.push).toBe(0.72);
    expect(tl.opt).toBe(0.88);
    expect(tl.pills).toContain("exploded");
  });
  test("sorts beats by time", () => {
    const tl = parseTimeline({ duration: 10, script: [{ t: 5, act: "b" }, { t: 1, act: "a" }] });
    expect(tl.script.map((b) => b.act)).toEqual(["a", "b"]);
  });
  test("rejects malformed timelines", () => {
    expect(() => parseTimeline(null)).toThrow();
    expect(() => parseTimeline({ duration: -1, script: [{ t: 0, act: "a" }] })).toThrow();
    expect(() => parseTimeline({ duration: 10, script: [] })).toThrow();
    expect(() => parseTimeline({ duration: 10, script: [{ t: 11, act: "a" }] })).toThrow();
    expect(() => parseTimeline({ duration: 10, script: [{ t: 1 }] })).toThrow();
  });
});

describe("beatAt / explodeWindow", () => {
  const tl = parseTimeline(tarantula);
  test("finds the running beat", () => {
    expect(beatAt(tl, 0)).toBeNull();
    expect(beatAt(tl, 3.2)?.act).toBe("eyes");
    expect(beatAt(tl, 14)?.act).toBe("exploded");
    expect(beatAt(tl, 17)?.act).toBe("assemble");
    expect(beatAt(tl, 24)?.act).toBe("jump");
  });
  test("every film explodes, then reassembles", () => {
    for (const raw of [piranha, tarantula, wasp]) {
      const w = explodeWindow(parseTimeline(raw))!;
      expect(w.assemble).toBeGreaterThan(w.explode);
    }
  });
});
