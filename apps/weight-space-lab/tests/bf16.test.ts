import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodeBf16, bitsHex, bitsFields, flatToRowCol, decodeTensor, columnDetail, touchedSlots, totalChanged, type WeightEdit } from "@/lib/bf16";

const edit = JSON.parse(readFileSync(join(import.meta.dir, "../public/data/weight-edit.json"), "utf8")) as WeightEdit;

describe("bfloat16 decoding", () => {
  test("known bit patterns", () => {
    expect(decodeBf16(0x3f80)).toBe(1);
    expect(decodeBf16(0xbf80)).toBe(-1);
    expect(decodeBf16(0x0000)).toBe(0);
    expect(decodeBf16(0x4049)).toBeCloseTo(3.140625, 6);
    expect(decodeBf16(15749)).toBe(0.06494140625);
    expect(bitsHex(15749)).toBe("0x3D85");
    expect(bitsFields(0xbf80)).toEqual({ sign: "1", exponent: "01111111", mantissa: "0000000" });
  });
  test("flat row-major index", () => {
    expect(flatToRowCol(0, 3584)).toEqual({ row: 0, col: 0 });
    expect(flatToRowCol(3584 + 11, 3584)).toEqual({ row: 1, col: 11 });
    expect(flatToRowCol(1023 * 3584 + 3003, 3584)).toEqual({ row: 1023, col: 3003 });
  });
});

describe("real edit file", () => {
  const [l15, l19] = edit.manifest;
  test("tensor metadata", () => {
    expect(l15.tensor).toBe("model.language_model.layers.15.mlp.down_proj.weight");
    expect(l19.tensor).toBe("model.language_model.layers.19.mlp.down_proj.weight");
    expect(l15.shape).toEqual([1024, 3584]);
    expect(l15.columns.slice(0, 5)).toEqual([0, 2, 11, 25, 34]);
    expect(l19.columns.slice(0, 5)).toEqual([1, 5, 8, 11, 13]);
  });
  test("130,188 changed entries vs 131,072 touched slots", () => {
    expect(l15.idx.length).toBe(65260);
    expect(l19.idx.length).toBe(64928);
    expect(totalChanged(edit.manifest)).toBe(130188);
    expect(touchedSlots(edit.manifest)).toBe(131072);
  });
  test("decoded tensors agree with manifest", () => {
    const d15 = decodeTensor(l15);
    const d19 = decodeTensor(l19);
    expect(d15.changedEntries).toBe(l15.changed_entries);
    expect(d19.changedEntries).toBe(l19.changed_entries);
    expect(d15.changedRows).toBe(1024);
    expect(d19.changedRows).toBe(1023);
    expect(d15.maxAbs).toBeGreaterThan(0.01);
    expect(d15.maxAbs).toBeLessThan(10);
  });
  test("column detail", () => {
    const d15 = decodeTensor(l15);
    const c0 = columnDetail(d15, 0)!;
    expect(c0.entries[0]).toEqual({ row: 0, idx: 0, bits: 15749, value: 0.06494140625 });
    const sum = l15.columns.reduce((s, c) => s + columnDetail(d15, c)!.entries.length, 0);
    expect(sum).toBe(65260);
    expect(columnDetail(d15, 1)).toBeNull();
    for (const e of c0.entries) expect(e.idx % 3584).toBe(0);
  });
});
