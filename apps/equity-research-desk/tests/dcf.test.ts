import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import fixture from "./fixtures/assumptions.json";
import sampleConfig from "../data/sample/smci-assumptions.json";
import sampleValuation from "../data/sample/smci-valuation.json";

const py = (args: string[], input?: string) => spawnSync("python3", ["-I", ...args], { input, encoding: "utf8" });

describe("vendored dcf.py", () => {
  test("--demo runs the upstream self check", () => {
    const r = py(["python/dcf.py", "--demo"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("情景 DCF");
    expect(r.stdout).toContain("概率加权公允价值: 57.5/股");
    expect(r.stdout).toContain("反向 DCF");
    expect(r.stdout).toContain("标定");
  });

  test("--config with a fixture prints the expected weighted value", () => {
    const r = py(["python/dcf.py", "--config", "tests/fixtures/assumptions.json"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("概率加权公允价值");
  });

  test("rejects WACC at or below terminal growth with exit code 2", () => {
    const bad = { ...fixture, wacc: 0.02, terminal_g: 0.03 };
    const r = spawnSync("python3", ["-I", "-c", `import json,sys;sys.path.insert(0,'python');import dcf;dcf.run(json.loads(sys.argv[1]))`, JSON.stringify(bad)], { encoding: "utf8" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("WACC");
  });
});

describe("runner.py JSON wrapper", () => {
  test("--demo matches dcf.py numbers", () => {
    const out = JSON.parse(py(["python/runner.py", "--demo"]).stdout);
    expect(out.ok).toBe(true);
    expect(out.result.weighted).toBeCloseTo(57.515, 2);
    expect(out.result.calibrate.label).toBe("overvalued");
    expect(out.result.ranges.map((r: { id: string }) => r.id)).toEqual(["dcf", "sens", "epv", "eva", "mc"]);
    expect(out.result.reverse.rows[0].implied_cagr).toBeCloseTo(0.3445, 3);
  });

  test("fixture JSON on stdin returns every method", () => {
    const out = JSON.parse(py(["python/runner.py"], JSON.stringify(fixture)).stdout);
    expect(out.ok).toBe(true);
    const r = out.result;
    expect(Object.keys(r.scenarios)).toEqual(["bear", "base", "bull"]);
    expect(r.scenarios.bear.per_share).toBeLessThan(r.scenarios.base.per_share);
    expect(r.scenarios.base.per_share).toBeLessThan(r.scenarios.bull.per_share);
    expect(r.composite.low).toBeLessThanOrEqual(r.composite.high);
    expect(r.montecarlo.p10).toBeLessThanOrEqual(r.montecarlo.p90);
    expect(r.transcript).toContain("=== 输入 ===");
  });

  test("bundled sample valuation is reproducible from the sample assumptions", () => {
    const out = JSON.parse(py(["python/runner.py"], JSON.stringify(sampleConfig)).stdout);
    expect(out.result.weighted).toBeCloseTo(sampleValuation.weighted!, 6);
    expect(out.result.composite).toEqual(sampleValuation.composite);
  });

  test("invalid config returns ok false", () => {
    const out = JSON.parse(py(["python/runner.py"], JSON.stringify({ shares: 1 })).stdout);
    expect(out.ok).toBe(false);
  });
});
