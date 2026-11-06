import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_PAIR_FILE, defaultIndex, recordingUrl, runStats, passTurns, type BenchmarkFile, type Recording, type RecordingIndexRow, type TrajectoryFile } from "@/lib/data";
import { closesThinking, hasBoxed, trimTrailing } from "@/lib/text";

const dir = join(import.meta.dir, "../public/data");
const read = <T,>(p: string) => JSON.parse(readFileSync(join(dir, p), "utf8")) as T;
const index = read<RecordingIndexRow[]>("recordings/index.json");

describe("recordings", () => {
  test("20 pairs, each file loads and matches its index row", () => {
    expect(index.length).toBe(20);
    expect(new Set(index.map((r) => r.id)).size).toBe(20);
    for (const row of index) {
      const rec = read<Recording>(`recordings/${row.file}`);
      expect(rec.id).toBe(row.id);
      expect(rec.gold_answer).toBe(row.gold_answer);
      expect(rec.base.length).toBe(row.base_chars);
      expect(rec.edited.length).toBe(row.edited_chars);
      expect(recordingUrl(row.file)).toBe(`/data/recordings/${row.file}`);
    }
  });
  test("default pair: base loops, edited closes thinking and boxes", () => {
    const i = defaultIndex(index);
    expect(index[i].file).toBe(DEFAULT_PAIR_FILE);
    const rec = read<Recording>(`recordings/${DEFAULT_PAIR_FILE}`);
    expect(closesThinking(rec.base) || hasBoxed(rec.base)).toBe(false);
    expect(closesThinking(rec.edited) && hasBoxed(rec.edited)).toBe(true);
  });
  test("trailing trim only removes whitespace", () => {
    const rec = read<Recording>("recordings/prealgebra-1622.json");
    const t = trimTrailing(rec.edited);
    expect(rec.edited.startsWith(t)).toBe(true);
    expect(rec.edited.slice(t.length).trim()).toBe("");
    expect(t.length).toBe(103185);
  });
  test("recording url rejects traversal", () => {
    expect(() => recordingUrl("../x.json")).toThrow();
  });
});

describe("author data", () => {
  test("benchmarks: 8 benchmarks, budgets 0/10/25/50, MATH-500 numbers", () => {
    const b = read<BenchmarkFile>("author-benchmarks.json");
    expect(b.benchmarks.map((x) => x.name)).toEqual(["MATH-500", "GSM8K", "AMC23", "Minerva Math", "OlympiadBench", "MMLU-Pro", "GPQA Diamond", "IFEval"]);
    for (const x of b.benchmarks) expect(x.points.map((p) => p.passes)).toEqual([0, 10, 25, 50]);
    expect(b.benchmarks[0].points.map((p) => p.score)).toEqual([7.9, 12.3, 14.1, 48.1]);
  });
  test("trajectory counts match the author's account", () => {
    const t = read<TrajectoryFile>("author-trajectories.json");
    const by = Object.fromEntries(t.runs.map((r) => [r.run, r]));
    const p50 = runStats(by.p50c);
    expect(p50.turns).toBe(158);
    expect(p50.pythonRan).toBe(80);
    expect(p50.passesUsed).toBe(50);
    expect(passTurns(by.p50c).length).toBe(50);
    expect(runStats(by.p25c).turns).toBe(86);
    expect(runStats(by.p10c).turns).toBe(74);
    expect(runStats(by.p25c).passesUsed).toBe(25);
    expect(runStats(by.p10c).passesUsed).toBe(10);
  });
});
