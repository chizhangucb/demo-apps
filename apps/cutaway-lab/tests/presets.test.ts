import { describe, expect, test } from "bun:test";
import { actLabel, DEFAULT_PRESET, partIdFor, PRESET_ORDER, PRESETS } from "@/lib/presets";

describe("part-id mapping", () => {
  test("defaults to Serrasal PX-7", () => {
    expect(DEFAULT_PRESET).toBe("piranha");
    expect(`${PRESETS.piranha.name} ${PRESETS.piranha.code}`).toBe("Serrasal PX-7");
  });
  test("piranha acts map to the upstream ACTS labels", () => {
    const p = PRESETS.piranha;
    expect(p.parts.map((x) => [x.id, x.label])).toEqual([
      ["optics", "Eye"],
      ["wing", "Fin"],
      ["leg", "Tail"],
      ["thorax", "Glass flank"],
      ["abdomen", "Jaw"],
    ]);
    expect(actLabel(p, "exploded")).toBe("Teardown");
    expect(actLabel(p, "hero")).toBe("Release");
  });
  test("tarantula and wasp parts", () => {
    expect(PRESETS.tarantula.parts.map((x) => x.label)).toEqual(["Optics", "Front leg", "Abdomen", "Head"]);
    expect(partIdFor(PRESETS.tarantula, "front leg")).toBe("leg");
    expect(partIdFor(PRESETS.tarantula, "Optics")).toBe("eyes");
    expect(PRESETS.wasp.parts.map((x) => x.label)).toEqual(["Optics", "Wings", "Legs", "Thorax", "Abdomen"]);
    expect(partIdFor(PRESETS.wasp, "Wings")).toBe("wing");
    expect(partIdFor(PRESETS.wasp, "Tail")).toBeNull();
  });
  test("every film beat has a label on its preset", () => {
    for (const id of PRESET_ORDER) {
      const p = PRESETS[id];
      for (const b of p.timeline.script) expect(actLabel(p, b.act)).not.toBe(b.act);
    }
  });
  test("part ids are unique per preset", () => {
    for (const id of PRESET_ORDER) {
      const ids = PRESETS[id].parts.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
