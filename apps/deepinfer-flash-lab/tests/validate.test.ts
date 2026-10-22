import { describe, expect, test } from "bun:test";
import { validateJson } from "../src/lib/validate";
import { STRUCTURED_PRESETS } from "../data/samples/presets";

const deepinfer = STRUCTURED_PRESETS.find((p) => p.id === "deepinfer-example")!.schema;

describe("schema validation", () => {
  test("passes the upstream example shape", () => {
    const r = validateJson(deepinfer, '{"color":"red","count":2}');
    expect(r.valid).toBe(true);
    expect(r.fields.map((f) => [f.field, f.ok])).toEqual([["color", true], ["count", true]]);
  });

  test("fails per field: bad enum, missing required, extra property", () => {
    const r = validateJson(deepinfer, '{"color":"purple","size":1}');
    expect(r.valid).toBe(false);
    const byField = Object.fromEntries(r.fields.map((f) => [f.field, f]));
    expect(byField.color.ok).toBe(false);
    expect(byField.color.messages[0]).toContain("must be one of");
    expect(byField.count.ok).toBe(false);
    expect(byField.count.messages).toContain("missing (required)");
    expect(r.rootErrors.some((e) => e.includes('"size"'))).toBe(true);
  });

  test("reports unparseable JSON and broken schemas", () => {
    expect(validateJson(deepinfer, "{nope").parseError).not.toBeNull();
    expect(validateJson({ type: "not-a-type" }, "{}").schemaError).not.toBeNull();
  });

  test("every structured sample validates against its own schema", () => {
    for (const p of STRUCTURED_PRESETS) {
      expect(validateJson(p.schema, JSON.stringify(p.sampleOutput)).valid).toBe(true);
    }
  });
});
