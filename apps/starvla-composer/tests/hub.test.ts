import { describe, expect, test } from "bun:test";
import { isOfficialRepo, parseHubList, parseHubModel } from "../src/lib/hub";
import { CATALOG } from "../src/lib/data";

const sample = {
  id: "StarVLA/Qwen3VL-GR00T-Bridge-RT-1",
  pipeline_tag: "robotics",
  tags: ["robotics", "base_model:Qwen/Qwen3-VL-4B-Instruct", "base_model:finetune:Qwen/Qwen3-VL-4B-Instruct"],
  downloads: 134,
  likes: 0,
  lastModified: "2026-09-04T08:28:59.000Z",
};

describe("hub payload parsing", () => {
  test("parses a model record", () => {
    const m = parseHubModel(sample)!;
    expect(m.id).toBe("StarVLA/Qwen3VL-GR00T-Bridge-RT-1");
    expect(m.downloads).toBe(134);
    expect(m.likes).toBe(0);
    expect(m.pipelineTag).toBe("robotics");
    expect(m.baseModels).toEqual(["Qwen/Qwen3-VL-4B-Instruct"]);
  });
  test("rejects garbage and non-StarVLA ids", () => {
    expect(parseHubModel(null)).toBeNull();
    expect(parseHubModel("x")).toBeNull();
    expect(parseHubModel({ id: "someone/fork" })).toBeNull();
    expect(parseHubModel({ error: "Repository not found" })).toBeNull();
  });
  test("tolerates missing numeric fields", () => {
    const m = parseHubModel({ id: "StarVLA/pi-fast", downloads: "lots" })!;
    expect(m.downloads).toBeNull();
    expect(m.lastModified).toBeNull();
  });
  test("list diff against the vendored snapshot", () => {
    const live = [...CATALOG.slice(1).map((e) => ({ id: e.id })), { id: "StarVLA/New-Model" }, { id: "fork/StarVLA" }];
    const r = parseHubList(live)!;
    expect(r.ids.length).toBe(45);
    expect(r.added).toEqual(["StarVLA/New-Model"]);
    expect(r.missing).toEqual([CATALOG[0].id]);
    expect(parseHubList({ error: "x" })).toBeNull();
  });
  test("only vendored ids can be looked up", () => {
    expect(isOfficialRepo("StarVLA/Qwen3VL-GR00T-Bridge-RT-1")).toBe(true);
    expect(isOfficialRepo("StarVLA/../../evil")).toBe(false);
    expect(isOfficialRepo("someone/model")).toBe(false);
  });
});
