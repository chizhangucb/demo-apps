import { describe, expect, test } from "bun:test";
import { band, initState, pace, pickOrder, simulate, type ConvState, type PickInput } from "../src/lib/routing/engine";
import type { Account, AccountState, Mode } from "../src/lib/routing/types";
import { DEFAULT_CONFIG, SCENARIO } from "../data/scenario";

function acct(id: string, fiveH: [number, number] | null, wk: [number, number] | null): Account {
  const windows: Account["windows"] = [];
  if (fiveH) windows.push({ kind: "5h", cap: 1000, startPct: fiveH[0], resetAt: fiveH[1] });
  if (wk) windows.push({ kind: "week", cap: 10_000, startPct: wk[0], resetAt: wk[1] });
  return { id, label: id, plan: "", provider: "", model: "m", tier: "strong", windows, price: { input: 1, output: 1 }, color: "" };
}

function input(mode: Mode, accounts: Account[], over: Partial<PickInput> = {}): PickInput {
  const states: Record<string, AccountState> = Object.fromEntries(accounts.map((a) => [a.id, initState(a)]));
  return {
    mode,
    stays: "off",
    sink: false,
    members: accounts.map((a) => ({ id: a.id })),
    states,
    now: 0,
    conv: { served: new Set() },
    convId: "c1",
    ...over,
  };
}

const order = (inp: PickInput) => pickOrder(inp).order;

describe("pace", () => {
  test("docs example: 60% left with 20 hours to go is 3 per hour", () => {
    expect(pace(60, 20)).toBe(3);
  });
  test("hours until renewal count as at least 1", () => {
    expect(pace(30, 0.25)).toBe(30);
  });
  test("highest pace goes first", () => {
    // a: 60% left / 20h = 3. b: 80% left / 80h = 1. c: 20% left / 4h = 5.
    const accs = [acct("a", null, [40, 20]), acct("b", null, [20, 80]), acct("c", null, [80, 4])];
    expect(order(input("pace", accs))).toEqual(["c", "a", "b"]);
  });
  test("90% and 98% bands go behind the others", () => {
    const accs = [acct("hot", null, [95, 2]), acct("cool", null, [10, 100]), acct("dry", null, [99, 1])];
    expect(order(input("pace", accs))).toEqual(["cool", "hot", "dry"]);
  });
});

describe("order", () => {
  test("holds the first member until it is used up (100%)", () => {
    const accs = [acct("first", [97, 3], [99, 50]), acct("second", [0, 3], [0, 50])];
    expect(order(input("order", accs))).toEqual(["first", "second"]);
  });
  test("moves on once the first member reaches 100%", () => {
    const accs = [acct("first", [100, 3], [50, 50]), acct("second", [0, 3], [0, 50])];
    const out = pickOrder(input("order", accs));
    expect(out.order).toEqual(["second"]);
    expect(out.steps[0].note).toContain("first");
  });
  test("stickiness keeps an order member up to 100%, not 98%", () => {
    const accs = [acct("a", null, [10, 50]), acct("b", null, [99, 50])];
    const conv: ConvState = { lastAccount: "b", lastAt: 0, lastCached: 5000, served: new Set(["b"]) };
    expect(order(input("order", accs, { stays: "session", conv }))[0]).toBe("b");
    expect(order(input("smart", accs, { stays: "session", conv }))[0]).toBe("a");
  });
  test("a failure moves the group on in the simulation without the agent seeing it", () => {
    const res = simulate({ ...DEFAULT_CONFIG, mode: "order" }, SCENARIO);
    const failover = res.turns.find((t) => t.attempts.length > 1 && t.servedBy);
    expect(failover).toBeDefined();
    expect(failover!.attempts[0].accountId).toBe("max-work");
    expect(failover!.agentError).toBe(false);
  });
});

describe("smart", () => {
  test("of the accounts under 90%, the one renewing soonest goes first", () => {
    const accs = [acct("late", [0, 3], [10, 100]), acct("soon", [0, 3], [50, 5]), acct("mid", [0, 3], [10, 30])];
    expect(order(input("smart", accs))).toEqual(["soon", "mid", "late"]);
  });
  test("at 90% an account goes behind; at 98% behind those", () => {
    const accs = [acct("soon90", [0, 3], [92, 5]), acct("soon98", [0, 3], [98, 2]), acct("late", [0, 3], [10, 100])];
    expect(order(input("smart", accs))).toEqual(["late", "soon90", "soon98"]);
  });
  test("weeks renewing in the same hour: the 5-hour window decides", () => {
    const accs = [acct("a", [0, 4], [10, 30.2]), acct("b", [0, 1], [10, 30.7])];
    expect(order(input("smart", accs))).toEqual(["b", "a"]);
  });
});

describe("rotate (In turn)", () => {
  test("each turn of a conversation goes to the next member", () => {
    const accs = [acct("a", null, [0, 50]), acct("b", null, [0, 50]), acct("c", null, [0, 50])];
    const conv: ConvState = { lastAccount: "b", lastAt: 0, lastCached: 9999, served: new Set() };
    expect(order(input("rotate", accs, { conv, stays: "auto" }))).toEqual(["c", "a", "b"]);
  });
  test("a new conversation goes to the account with the fewest other conversations in 30 minutes", () => {
    const accs = [acct("a", null, [0, 50]), acct("b", null, [0, 50])];
    const inp = input("rotate", accs, { now: 40 });
    inp.states.a.recent = [{ t: 20, conv: "x", tokens: 1 }, { t: 25, conv: "y", tokens: 1 }];
    inp.states.b.recent = [{ t: 30, conv: "z", tokens: 1 }, { t: 1, conv: "old", tokens: 1 }];
    expect(order(inp)).toEqual(["b", "a"]);
  });
  test("costs the most prompt cache misses over the scripted day", () => {
    const misses = (mode: Mode) => simulate({ ...DEFAULT_CONFIG, mode }, SCENARIO).totals.cacheMisses;
    expect(misses("rotate")).toBeGreaterThan(misses("smart"));
    expect(misses("rotate")).toBeGreaterThan(misses("order"));
  });
});

describe("usage (Least used first)", () => {
  test("lowest share used first", () => {
    const accs = [acct("a", [50, 3], [20, 50]), acct("b", [5, 3], [30, 50]), acct("c", [10, 3], [10, 50])];
    // Share used is the fullest window: a 50%, b 30%, c 10%.
    expect(order(input("usage", accs))).toEqual(["c", "b", "a"]);
  });
  test("ties go to the fewest tokens sent lately", () => {
    const accs = [acct("a", null, [20, 50]), acct("b", null, [20, 50])];
    const inp = input("usage", accs, { now: 30 });
    inp.states.a.recent = [{ t: 10, conv: "x", tokens: 5000 }];
    inp.states.b.recent = [{ t: 10, conv: "y", tokens: 100 }];
    expect(order(inp)).toEqual(["b", "a"]);
  });
});

describe("pick steps 1 to 6", () => {
  test("paused accounts are skipped", () => {
    const accs = [acct("a", null, [0, 50]), acct("b", null, [0, 50])];
    const inp = input("order", accs);
    inp.members[0].paused = true;
    expect(order(inp)).toEqual(["b"]);
  });
  test("Sink puts rate limited accounts last, fallback models after own accounts, resting last", () => {
    const accs = ["a", "b", "c", "d"].map((id) => acct(id, null, [0, 50]));
    const inp = input("order", accs, { sink: true, now: 10 });
    inp.states.a.rateLimitedUntil = 60;
    inp.members[1].fallback = true;
    inp.states.c.restingUntil = 20;
    const steps = pickOrder(inp).steps;
    expect(steps[2].order).toEqual(["b", "c", "d", "a"]);
    expect(steps[3].order).toEqual(["c", "d", "a", "b"]);
    expect(steps[4].order).toEqual(["d", "a", "b", "c"]);
  });
  test("resting accounts are never dropped", () => {
    const accs = [acct("a", null, [0, 50])];
    const inp = input("order", accs, { now: 1 });
    inp.states.a.restingUntil = 50;
    expect(order(inp)).toEqual(["a"]);
  });
  test("stays=auto keeps the conversation's account while the cache is worth keeping", () => {
    const accs = [acct("soon", null, [0, 5]), acct("late", null, [0, 90])];
    const warm: ConvState = { lastAccount: "late", lastAt: 8, lastCached: 4000, served: new Set() };
    const cold: ConvState = { lastAccount: "late", lastAt: 0, lastCached: 4000, served: new Set() };
    const small: ConvState = { lastAccount: "late", lastAt: 9, lastCached: 500, served: new Set() };
    expect(order(input("smart", accs, { stays: "auto", conv: warm, now: 10 }))[0]).toBe("late");
    expect(order(input("smart", accs, { stays: "auto", conv: cold, now: 10 }))[0]).toBe("soon");
    expect(order(input("smart", accs, { stays: "auto", conv: small, now: 10 }))[0]).toBe("soon");
    expect(order(input("smart", accs, { stays: "off", conv: warm, now: 10 }))[0]).toBe("soon");
  });
  test("stickiness never brings back a resting account, but strict keeps it", () => {
    const accs = [acct("a", null, [0, 5]), acct("b", null, [0, 90])];
    const conv: ConvState = { lastAccount: "b", lastAt: 9, lastCached: 4000, served: new Set() };
    const inp = input("smart", accs, { stays: "session", conv, now: 10 });
    inp.states.b.restingUntil = 30;
    expect(order(inp)[0]).toBe("a");
    expect(order({ ...inp, stays: "strict" })[0]).toBe("b");
  });
  test("band helper", () => {
    expect(band(initState(acct("x", [89, 1], [0, 9])))).toBe(0);
    expect(band(initState(acct("x", [90, 1], [0, 9])))).toBe(1);
    expect(band(initState(acct("x", [10, 1], [98, 9])))).toBe(2);
  });
});

describe("scripted day", () => {
  test("is deterministic", () => {
    const a = simulate(DEFAULT_CONFIG, SCENARIO);
    const b = simulate(DEFAULT_CONFIG, SCENARIO);
    expect(a.turns.map((t) => t.servedBy)).toEqual(b.turns.map((t) => t.servedBy));
    expect(SCENARIO.turns.length).toBeGreaterThanOrEqual(40);
    expect(SCENARIO.turns.length).toBeLessThanOrEqual(60);
  });
  test("default smart run fails over with no error reaching any agent", () => {
    const r = simulate(DEFAULT_CONFIG, SCENARIO);
    expect(r.totals.failovers).toBeGreaterThan(0);
    expect(r.totals.agentErrors).toBe(0);
  });
  test("smart loses less weekly quota at resets than order", () => {
    const lost = (mode: Mode) => simulate({ ...DEFAULT_CONFIG, mode }, SCENARIO).totals.lostWeek;
    expect(lost("smart")).toBeLessThan(lost("order"));
  });
  test("stays=strict passes the sticky account's error to the agent", () => {
    const r = simulate({ ...DEFAULT_CONFIG, stays: "strict" }, SCENARIO);
    expect(r.totals.agentErrors).toBeGreaterThan(0);
  });
  test("intent routing sends quick questions to the cheap tier and tests to the strong tier", () => {
    const r = simulate({ ...DEFAULT_CONFIG, intent: true }, SCENARIO);
    const tierOf = (id: string | null) => SCENARIO.accounts.find((a) => a.id === id)?.tier;
    const routed = r.turns.filter((t) => t.routed && t.servedBy && t.attempts.length === 1);
    for (const t of routed.filter((t) => t.turn.kind === "quick")) expect(tierOf(t.servedBy)).toBe("cheap");
    for (const t of routed.filter((t) => t.turn.kind === "test")) expect(tierOf(t.servedBy)).toBe("strong");
    expect(r.totals.classifierCost).toBeGreaterThan(0);
  });
});
