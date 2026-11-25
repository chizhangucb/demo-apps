import { describe, expect, test } from "bun:test";
import {
  agentOrder,
  agents,
  aggregates,
  DEFAULT_A,
  DEFAULT_B,
  SETTINGS,
  suites,
  taskUrl,
  tests,
  type CoreTest,
} from "@/lib/data";
import {
  buildItems,
  groupBySuite,
  headline,
  items,
  pairDiff,
  pct,
  promptCell,
  promptLift,
  rank,
  suiteBoards,
  unsolvedByAll,
} from "@/lib/score";

const ASTRA = DEFAULT_A;
const FABLE = DEFAULT_B;
const GPT6_ASTRA = "codex-gpt6_astra-high";
const SOL = "codex-gpt6_1_sol-high";
const OPUS = "claude_code-opus_5_5-high";
const ARGON = "antigravity_cli-gemini_4_argon-high";
const QWEN = "claude_code-qwen4_max-high";

function board(setting: Parameters<typeof suiteBoards>[0], suite: string) {
  const b = suiteBoards(setting).find((x) => x.suite === suite);
  if (!b) throw new Error(suite);
  return b;
}
function score(setting: Parameters<typeof suiteBoards>[0], suite: string, agent: string) {
  return board(setting, suite).scores.find((s) => s.agent === agent)!.solved;
}

describe("snapshot shape", () => {
  test("11 ranked agents, 32 suites, 951 core tests, no Luna", () => {
    expect(agents).toHaveLength(11);
    expect(agentOrder).toHaveLength(11);
    expect(suites).toHaveLength(32);
    expect(tests).toHaveLength(951);
    expect(agentOrder.some((a) => a.includes("luna"))).toBe(false);
    for (const t of tests) expect(t.v).toMatch(/^[SF]{11}$/);
  });
});

describe("setting filters", () => {
  test("mode sizes match the official core set", () => {
    expect(items("standard")).toHaveLength(481);
    expect(items("privileged")).toHaveLength(416);
    expect(items("realtime")).toHaveLength(54);
    expect(items("overall")).toHaveLength(481);
  });
  test("each mode view only holds tests of that mode", () => {
    for (const s of ["standard", "privileged", "realtime"] as const) {
      expect(items(s).every((it) => it.modes.length === 1 && it.modes[0] === s)).toBe(true);
    }
  });
  test("RoboEngineer has no Privileged core tests", () => {
    expect(board("privileged", "roboengineer").tests).toBe(0);
    expect(board("privileged", "roboengineer").leaders).toEqual([]);
  });
});

describe("headline totals equal the official exam.json views", () => {
  for (const setting of SETTINGS) {
    test(setting, () => {
      for (const a of agents) {
        expect(headline(a.id, setting)).toEqual(aggregates.views[setting][a.id]);
        expect(headline(a.id, setting)).toEqual(a.scores[setting]);
      }
    });
  }
  test("one-decimal rates for the top two", () => {
    expect(pct(headline(ASTRA, "overall"))).toBe("54.1%");
    expect(pct(headline(ASTRA, "standard"))).toBe("58.0%");
    expect(pct(headline(ASTRA, "privileged"))).toBe("95.0%");
    expect(pct(headline(ASTRA, "realtime"))).toBe("40.7%");
    expect(pct(headline(FABLE, "overall"))).toBe("46.8%");
    expect(pct(headline(FABLE, "standard"))).toBe("51.6%");
    expect(pct(headline(FABLE, "privileged"))).toBe("81.0%");
    expect(pct(headline(FABLE, "realtime"))).toBe("40.7%");
  });
  test("Overall ranking order matches the official board", () => {
    expect(rank("overall").map((r) => r.agent)).toEqual(agentOrder);
  });
});

describe("pair diffs", () => {
  test("default pair matches the vendored counts in every setting", () => {
    const want = aggregates.default_pair.counts;
    for (const s of SETTINGS) {
      const d = pairDiff(ASTRA, FABLE, s);
      expect(d.n).toBe(want[s].n);
      expect(d.onlyA.length).toBe(want[s].only_gpt6_2_astra);
      expect(d.onlyB.length).toBe(want[s].only_fable_5_2);
      expect(d.both).toBe(want[s].both);
      expect(d.neither).toBe(want[s].neither);
    }
  });
  test("Standard 96 / 65 / 183 / 137 and Privileged 63 / 5 / 332 / 16", () => {
    const st = pairDiff(ASTRA, FABLE, "standard");
    expect([st.onlyA.length, st.onlyB.length, st.both, st.neither, st.n]).toEqual([96, 65, 183, 137, 481]);
    const pr = pairDiff(ASTRA, FABLE, "privileged");
    expect([pr.onlyA.length, pr.onlyB.length, pr.both, pr.neither, pr.n]).toEqual([63, 5, 332, 16, 416]);
  });
  test("swapping the pair mirrors the lists", () => {
    const ab = pairDiff(SOL, OPUS, "standard");
    const ba = pairDiff(OPUS, SOL, "standard");
    expect(ab.onlyA.map((i) => i.key)).toEqual(ba.onlyB.map((i) => i.key));
    expect(ab.both).toBe(ba.both);
  });
  test("same agent twice gives empty unique lists", () => {
    const d = pairDiff(SOL, SOL, "standard");
    expect(d.onlyA).toHaveLength(0);
    expect(d.onlyB).toHaveLength(0);
    expect(d.both).toBe(163);
  });
  test("partition always sums to n", () => {
    for (const s of SETTINGS) {
      const d = pairDiff(GPT6_ASTRA, QWEN, s);
      expect(d.onlyA.length + d.onlyB.length + d.both + d.neither).toBe(d.n);
    }
  });
  test("grouping by suite keeps every item", () => {
    const d = pairDiff(ASTRA, FABLE, "standard");
    const g = groupBySuite(d.onlyA);
    expect(g.reduce((n, x) => n + x.items.length, 0)).toBe(96);
    expect(g.find((x) => x.suite === "robopaint")!.items.length).toBeGreaterThan(0);
  });
  test("unknown agents are rejected", () => {
    expect(() => pairDiff("codex-gpt6_luna-xhigh", FABLE, "standard")).toThrow();
  });
});

describe("Overall task rule", () => {
  test("a task counts only if every core mode it has was solved", () => {
    const fake: CoreTest[] = [
      { suite: "x", id: "t1", title: "T1", setting: "standard", v: "SSFFFFFFFFF" },
      { suite: "x", id: "t1", title: "T1", setting: "privileged", v: "SFSFFFFFFFF" },
      { suite: "x", id: "t2", title: "T2", setting: "privileged", v: "FSFFFFFFFFF" },
    ];
    const ov = buildItems("overall", fake);
    expect(ov).toHaveLength(2);
    const t1 = ov.find((i) => i.id === "t1")!;
    expect(t1.modes).toEqual(["standard", "privileged"]);
    expect(t1.solved.slice(0, 3)).toEqual([true, false, false]);
    expect(ov.find((i) => i.id === "t2")!.solved[1]).toBe(true);
  });
  test("BEHAVIOR-1K Overall is Astra 38/71, not the Standard 40/71", () => {
    expect(score("overall", "behavior-1k", ASTRA)).toBe(38);
    expect(score("overall", "behavior-1k", FABLE)).toBe(19);
    expect(score("standard", "behavior-1k", ASTRA)).toBe(40);
    expect(score("standard", "behavior-1k", FABLE)).toBe(26);
    expect(board("overall", "behavior-1k").tests).toBe(71);
  });
});

describe("suite leaders", () => {
  test("per-suite scores equal aggregates.suite_scores", () => {
    for (const s of SETTINGS) {
      for (const b of suiteBoards(s)) {
        const want = aggregates.suite_scores[s][b.suite];
        if (!want) {
          expect(b.tests).toBe(0);
          continue;
        }
        for (const x of b.scores) expect({ solved: x.solved, tests: b.tests }).toEqual(want[x.agent]);
      }
    }
  });
  test("all 32 suites render in every setting", () => {
    for (const s of SETTINGS) expect(suiteBoards(s)).toHaveLength(32);
  });
  test("notable Standard leaders", () => {
    expect(board("standard", "robopaint")).toMatchObject({ leaders: [ASTRA], top: 21, tests: 22 });
    expect(board("standard", "embodied-safety-exam")).toMatchObject({ leaders: [FABLE], top: 35, tests: 50 });
    expect(board("standard", "maniguard")).toMatchObject({ leaders: [OPUS], top: 7, tests: 7 });
    expect(board("standard", "robodojo")).toMatchObject({ leaders: [FABLE], top: 28, tests: 37 });
    expect(board("standard", "roboarc")).toMatchObject({ leaders: [FABLE], top: 33, tests: 58 });
  });
  test("HumanoidBench: the vendored matrix gives a Standard 1/8 tie; GPT-6 Astra leads alone only in Overall", () => {
    // PLAN.md says GPT-6 Astra alone at 1/8 Standard; both core-results.json and
    // aggregates.json suite_scores say GPT-6.2 Astra also solves manip_window in Standard.
    expect(board("standard", "humanoidbench")).toMatchObject({ leaders: [ASTRA, GPT6_ASTRA], top: 1, tests: 8 });
    expect(board("overall", "humanoidbench")).toMatchObject({ leaders: [GPT6_ASTRA], top: 1, tests: 8 });
  });
  test("ManiGuard: nobody but Opus solves all seven", () => {
    const b = board("standard", "maniguard");
    expect(b.scores.filter((s) => s.solved === 7).map((s) => s.agent)).toEqual([OPUS]);
  });
  test("ties stay ties: RoboLab Standard is a four-way 2/6 tie with Qwen4 Max", () => {
    const b = board("standard", "robolab");
    expect(b.tests).toBe(6);
    expect(b.top).toBe(2);
    expect([...b.leaders].sort()).toEqual([ASTRA, FABLE, SOL, QWEN].sort());
  });
  test("runner-up ties in RoboDojo Standard", () => {
    expect(score("standard", "robodojo", ARGON)).toBe(21);
    expect(score("standard", "robodojo", GPT6_ASTRA)).toBe(21);
    expect(board("privileged", "robodojo")).toMatchObject({ leaders: [ASTRA], top: 37 });
  });
});

describe("unsolved counts", () => {
  test("111 Standard tests solved by no ranked agent, 169 without GPT-6.2 Astra", () => {
    expect(unsolvedByAll("standard")).toBe(aggregates.default_pair.unsolved_standard_all_11);
    expect(unsolvedByAll("standard")).toBe(111);
    expect(unsolvedByAll("standard", [ASTRA])).toBe(169);
  });
});

describe("RoboDojo prompt table", () => {
  test("lookup of the four published rows", () => {
    expect(promptCell("vla_prompt", "gpt6_astra")).toMatchObject({ solved: 12, tests: 54 });
    expect(promptCell("vla_prompt", "fable_5_2")).toMatchObject({ solved: 34, tests: 54 });
    expect(promptCell("robodojo_agent_prompt", "gpt6_astra")).toMatchObject({ solved: 33 });
    expect(promptCell("robodojo_agent_prompt", "fable_5_2")).toMatchObject({ solved: 40 });
    expect(promptCell("fully_specified_efe", "gpt6_astra")).toMatchObject({ solved: 37 });
    expect(promptCell("fully_specified_efe", "fable_5_2")).toMatchObject({ solved: 44 });
    expect(promptCell("robodojo_agent_harness", "gpt6_astra")).toMatchObject({ solved: 13 });
    expect(promptCell("robodojo_agent_harness", "fable_5_2")).toMatchObject({ solved: 15 });
    expect(() => promptCell("per_task", "fable_5_2")).toThrow();
  });
  test("lifts: Fable 63% to 81%, GPT-6 Astra 22% to 69%", () => {
    const f = promptLift("fable_5_2");
    expect([f.from.percent_label, f.to.percent_label, f.delta]).toEqual(["63%", "81%", 10]);
    const g = promptLift("gpt6_astra");
    expect([g.from.percent_label, g.to.percent_label, g.delta]).toEqual(["22%", "69%", 25]);
  });
  test("prompt table is 54 tasks, not the 37-test core column", () => {
    expect(promptCell("fully_specified_efe", "fable_5_2").tests).toBe(54);
    expect(board("standard", "robodojo").tests).toBe(37);
  });
});

test("task links URL-encode the slash", () => {
  expect(taskUrl("robopaint", "abc")).toBe("https://www.embodied-first-exam.ai/tasks/?task=robopaint%2Fabc");
});
