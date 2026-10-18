import { describe, expect, test } from "bun:test";
import {
  AGENTS,
  DeskSim,
  END_BALANCE,
  FILL_COUNT,
  LOG_CAP,
  PIPELINE,
  RUN_TICKS,
  START_BALANCE,
  TICKS_PER_SECOND,
  agentAt,
  mulberry32,
  planRun,
  preHistory,
} from "../src/lib/sim";

const runTo = (sim: DeskSim, tick: number) => {
  const lines = [];
  while (sim.tick < tick) lines.push(...sim.step());
  return lines;
};

describe("prng", () => {
  test("same seed, same stream", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 50; i++) expect(a()).toBe(b());
  });
  test("values in [0, 1)", () => {
    const r = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("balance trajectory", () => {
  const { fills, path } = planRun(159);
  test("starts at $91.17 and ends at about $837", () => {
    expect(path[0]).toBe(START_BALANCE);
    expect(path[RUN_TICKS]).toBeCloseTo(END_BALANCE, 6);
    expect(path).toHaveLength(RUN_TICKS + 1);
  });
  test("passes the middle of the climb mid run", () => {
    const mid = path[RUN_TICKS / 2];
    expect(mid).toBeGreaterThan(200);
    expect(mid).toBeLessThan(500);
  });
  test("wobbles with small dips", () => {
    let dips = 0;
    for (let i = 1; i < path.length; i++) if (path[i] < path[i - 1]) dips++;
    expect(dips).toBeGreaterThan(5);
  });
  test("fills fit inside the run, in order, with 6 losers", () => {
    expect(fills).toHaveLength(FILL_COUNT);
    expect(fills.filter((f) => !f.win)).toHaveLength(6);
    for (let i = 1; i < fills.length; i++) expect(fills[i].tick).toBeGreaterThan(fills[i - 1].tick);
    expect(fills.at(-1)!.tick).toBeLessThanOrEqual(RUN_TICKS - 2);
    for (const f of fills) expect(f.win ? f.after > f.before : f.after < f.before).toBe(true);
  });
  test("pre history climbs from the initial balance to the start balance", () => {
    const h = preHistory(159);
    expect(h.at(-1)).toBe(START_BALANCE);
    expect(Math.abs(h[0] - 89.2)).toBeLessThan(0.5);
  });
});

describe("desk sim", () => {
  test("starts at the spec numbers", () => {
    const s = new DeskSim().stats();
    expect(s.balance).toBe(91.17);
    expect(s.pnl).toBeCloseTo(1.97, 2);
    expect(s.resolved).toBe(804);
    expect(s.winRate).toBeCloseTo(49.5, 1);
  });
  test("ends the run near $837, 831 resolved, about 50.4% win rate", () => {
    const sim = new DeskSim();
    runTo(sim, RUN_TICKS);
    const s = sim.stats();
    expect(s.balance).toBeCloseTo(837.42, 2);
    expect(s.resolved).toBe(831);
    expect(s.winRate).toBeGreaterThan(50.3);
    expect(s.winRate).toBeLessThan(50.5);
    expect(s.running).toBe(false);
  });
  test("log emits one to three lines per second with FILL, ORDER and system lines", () => {
    const sim = new DeskSim();
    const lines = runTo(sim, RUN_TICKS);
    const perSecond = lines.length / 30;
    expect(perSecond).toBeGreaterThan(1);
    expect(perSecond).toBeLessThan(3.5);
    expect(lines.filter((l) => l.kind === "fill")).toHaveLength(FILL_COUNT);
    expect(lines.filter((l) => l.kind === "order")).toHaveLength(FILL_COUNT);
    expect(lines.some((l) => l.desc === "settlement credited")).toBe(true);
    expect(lines.some((l) => l.desc === "settlement debited")).toBe(true);
    const ids = lines.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  test("fill values sum to the run gain", () => {
    const sim = new DeskSim();
    const lines = runTo(sim, RUN_TICKS);
    const sum = lines.filter((l) => l.kind === "fill").reduce((a, l) => a + l.value!, 0);
    expect(sum).toBeCloseTo(END_BALANCE - START_BALANCE, 6);
  });
  test("after the run only system lines appear and the balance holds near the end", () => {
    const sim = new DeskSim();
    runTo(sim, RUN_TICKS);
    const after = runTo(sim, RUN_TICKS + 200);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((l) => l.kind === "sys")).toBe(true);
    expect(Math.abs(sim.stats().balance - END_BALANCE) / END_BALANCE).toBeLessThan(0.01);
  });
  test("restart with the same seed replays the same run", () => {
    const a = new DeskSim(159);
    const b = new DeskSim(159);
    expect(runTo(a, 160)).toEqual(runTo(b, 160));
    expect(a.stats()).toEqual(b.stats());
  });
  test("different seeds give different runs with the same endpoints", () => {
    const a = new DeskSim(1);
    const b = new DeskSim(2);
    runTo(a, RUN_TICKS);
    runTo(b, RUN_TICKS);
    expect(a.path).not.toEqual(b.path);
    expect(a.stats().balance).toBeCloseTo(b.stats().balance, 6);
  });
  test("log cap is sane", () => expect(LOG_CAP).toBe(200));
});

describe("agent pipeline", () => {
  test("one agent per second in order BRAM, ILSA, HOLT, KETT, TESS", () => {
    const seq = Array.from({ length: 10 }, (_, s) => agentAt(s * TICKS_PER_SECOND));
    expect(seq).toEqual(["BRAM", "ILSA", "HOLT", "KETT", "TESS", "BRAM", "ILSA", "HOLT", "KETT", "TESS"]);
  });
  test("RIGO never runs in the scripted run", () => {
    for (let t = 0; t <= RUN_TICKS; t++) expect(agentAt(t)).not.toBe("RIGO");
    expect(PIPELINE).not.toContain("RIGO");
  });
  test("six agents numbered in card order", () => {
    expect(AGENTS.map((a) => a.id)).toEqual(["KETT", "BRAM", "ILSA", "HOLT", "TESS", "RIGO"]);
  });
});
