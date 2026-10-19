import { describe, expect, test } from "bun:test";
import { buildConfig } from "../src/lib/assumptions";
import { decide, footballField, gapTable } from "../src/lib/report";
import { sampleRun } from "../src/lib/sample";
import sampleConfig from "../data/sample/smci-assumptions.json";

const run = sampleRun();

describe("sample run (SMCI, cached EDGAR)", () => {
  test("parses four fiscal years of 10-K facts with sources", () => {
    expect(run.fundamentals.fiscalYears).toEqual(["2023-06-30", "2024-06-30", "2025-06-30", "2026-06-30"]);
    const rev = run.fundamentals.metrics.revenue.at(-1)!;
    expect(rev.value).toBeCloseTo(39063.1, 0);
    expect(rev.source).toBe("SEC 10-K FY2026");
    expect(rev.asOf).toBe("2026-06-30");
  });

  test("grades earnings quality D and vetoes the buy", () => {
    expect(run.quality.grade).toBe("D");
    const d = decide(run);
    expect(d.vetoed).toBe(true);
    expect(d.finalAction).toBe("Avoid");
    expect(d.vetoReason).toContain("grade D");
  });

  test("missing data shows not obtained instead of a guess", () => {
    expect(run.quality.beneish.m.value).toBeNull();
    expect(run.quality.beneish.missing).toEqual(["SGAI"]);
    expect(run.fundamentals.metrics.sga.every((x) => x.value === null)).toBe(true);
    const relative = footballField(run).find((r) => r.id === "relative")!;
    expect(relative.low).toBeNull();
    expect(decide(run).nearTerm).toBe("not obtained");
  });

  test("football field has market, methods, composite and the price", () => {
    const rows = footballField(run);
    expect(rows[0].id).toBe("market");
    expect(rows.at(-1)!.id).toBe("composite");
    expect(rows.filter((r) => r.kind === "method" && r.low !== null).length).toBe(5);
    expect(run.quote.price.value).toBeGreaterThan(0);
  });

  test("gap table rows carry sources or not obtained", () => {
    const rows = gapTable(run);
    expect(rows.map((r) => r.id)).toEqual(["revenue_cagr", "steady_fcf", "growth_share", "value", "quality"]);
    for (const r of rows) {
      expect(r.pricedInFact.value === null || Boolean(r.pricedInFact.source && r.pricedInFact.asOf)).toBe(true);
      expect(r.ourViewFact.value === null || Boolean(r.ourViewFact.source && r.ourViewFact.asOf)).toBe(true);
    }
  });

  test("assumption builder reproduces the bundled assumptions JSON", () => {
    const { config } = buildConfig(run.fundamentals, run.quote, run.inputs);
    expect(config).toEqual(sampleConfig as unknown as typeof config);
  });

  test("a grade C caps a buy at wait and see", () => {
    const c = { ...run, quality: { ...run.quality, grade: "C" as const }, valuation: { ...run.valuation, calibrate: { label: "undervalued", label_zh: "低估" } } };
    const d = decide(c);
    expect(d.modelAction).toBe("Buy");
    expect(d.finalAction).toBe("Wait and see");
  });
});
