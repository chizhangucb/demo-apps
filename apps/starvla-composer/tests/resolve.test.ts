import { describe, expect, test } from "bun:test";
import { BACKBONES, BENCHMARKS, CATALOG, DEFAULT_COMBO, HEADS, RECIPES, SCORES } from "../src/lib/data";
import { findScores, resolveCombo } from "../src/lib/resolve";

describe("catalog", () => {
  test("has exactly the 45 official ids, all unique and StarVLA-owned", () => {
    expect(CATALOG.length).toBe(45);
    expect(new Set(CATALOG.map((e) => e.id)).size).toBe(45);
    expect(CATALOG.every((e) => e.id.startsWith("StarVLA/"))).toBe(true);
  });
  test("every score checkpoint link is an official catalog id", () => {
    const ids = new Set(CATALOG.map((e) => e.id));
    for (const s of SCORES) if (s.checkpoint) expect(ids.has(s.checkpoint)).toBe(true);
  });
});

describe("combo resolution", () => {
  test("default combo is official checkpoint and score with 65.3 from both tables", () => {
    const r = resolveCombo(DEFAULT_COMBO);
    expect(r.status).toBe("official_checkpoint_and_score");
    expect(r.checkpoints.map((c) => c.id)).toEqual(["StarVLA/Qwen3VL-GR00T-Bridge-RT-1"]);
    expect(r.scores.map((s) => s.value)).toEqual([65.3, 65.3]);
    expect(r.agreement?.value).toBe(65.3);
    expect(r.disagreement).toBeNull();
  });

  test("Qwen3 OFT WidowX shows both 42.7 and 64.6 without reconciling", () => {
    const r = resolveCombo({ ...DEFAULT_COMBO, head: "oft" });
    expect(r.status).toBe("official_checkpoint_and_score");
    const vals = r.disagreement!.rows.map((x) => x.value).sort();
    expect(vals).toEqual([42.7, 64.6]);
    expect(r.agreement).toBeNull();
  });

  test("FAST Qwen3 WidowX is score only, with the Action-token caveat", () => {
    const r = resolveCombo({ ...DEFAULT_COMBO, head: "fast" });
    expect(r.status).toBe("official_score_only");
    expect(r.scores[0].value).toBe(31.6);
    expect(r.caveats.some((c) => c.text.includes("Action-token"))).toBe(true);
  });

  test("FAST Qwen3 LIBERO and PI Qwen3 RoboCasa GR1 are score only", () => {
    expect(resolveCombo({ backbone: "qwen3vl4b", head: "fast", recipe: "sft", benchmark: "libero" }).status).toBe("official_score_only");
    expect(resolveCombo({ backbone: "qwen3vl4b", head: "pi", recipe: "sft", benchmark: "robocasa_gr1" }).status).toBe("official_score_only");
  });

  test("RoboCasa365 is score only and carries the local snapshot disclaimer", () => {
    const r = resolveCombo({ backbone: "qwen3vl4b", head: "pi", recipe: "sft", benchmark: "robocasa365" });
    expect(r.status).toBe("official_score_only");
    expect(r.scores[0].value).toBe(40.64);
    expect(r.scores[0].caveat).toContain("Not official RoboCasa leaderboard");
  });

  test("Florence GR00T WidowX is checkpoint only (zoo shows -)", () => {
    const r = resolveCombo({ backbone: "florence2", head: "gr00t", recipe: "cotrain", benchmark: "simpler_widowx" });
    expect(r.status).toBe("official_checkpoint_only");
    expect(r.scores[0].value).toBeNull();
  });

  test("VLAct PI LIBERO-plus is checkpoint only", () => {
    const r = resolveCombo({ backbone: "vlact", head: "pi", recipe: "sft", benchmark: "libero_plus" });
    expect(r.status).toBe("official_checkpoint_only");
    expect(r.checkpoints[0].id).toBe("StarVLA/VLAct_Qwen3PI_Libero_Plus_Finetune");
  });

  test("Qwen3.5 and RL resolve to framework supported, no official release", () => {
    expect(resolveCombo({ ...DEFAULT_COMBO, backbone: "qwen35" }).status).toBe("framework_supported_no_official_release");
    const rl = resolveCombo({ ...DEFAULT_COMBO, recipe: "rl" });
    expect(rl.status).toBe("framework_supported_no_official_release");
    expect(rl.otherRecipe.checkpoints.map((c) => c.id)).toContain("StarVLA/Qwen3VL-GR00T-Bridge-RT-1");
    expect(rl.caveats.some((c) => c.text.includes("RLinf"))).toBe(true);
  });

  test("planned benchmarks and world-model FAST are not supported", () => {
    expect(resolveCombo({ ...DEFAULT_COMBO, benchmark: "so101" }).status).toBe("not_supported_or_planned");
    expect(resolveCombo({ ...DEFAULT_COMBO, benchmark: "rlbench" }).status).toBe("not_supported_or_planned");
    expect(resolveCombo({ ...DEFAULT_COMBO, backbone: "cosmos", head: "fast" }).status).toBe("not_supported_or_planned");
  });

  test("RoboTwin OFT links both repos and the 88.18 average", () => {
    const r = resolveCombo({ backbone: "qwen3vl4b", head: "oft", recipe: "sft", benchmark: "robotwin2" });
    expect(r.checkpoints.length).toBe(2);
    expect(r.scores[0].value).toBe(88.18);
  });

  test("VLAct RoboTwin does not inherit the StarVLA-OFT RoboTwin averages", () => {
    const r = resolveCombo({ backbone: "vlact", head: "oft", recipe: "sft", benchmark: "robotwin2" });
    expect(r.scores.length).toBe(0);
    expect(r.status).toBe("official_checkpoint_only");
  });

  test("BEHAVIOR surfaces QwenDual repos as related, not as matches", () => {
    const r = resolveCombo({ ...DEFAULT_COMBO, recipe: "sft", benchmark: "behavior" });
    expect(r.checkpoints.length).toBe(0);
    expect(r.relatedExtra.length).toBe(4);
  });

  test("every brick combination resolves deterministically", () => {
    let n = 0;
    for (const b of BACKBONES) for (const h of HEADS) for (const rc of RECIPES) for (const bm of BENCHMARKS) {
      const c = { backbone: b.id, head: h.id, recipe: rc.id, benchmark: bm.id };
      expect(resolveCombo(c)).toEqual(resolveCombo(c));
      n++;
    }
    expect(n).toBe(9 * 4 * 4 * 18);
  });
});

describe("score lookup", () => {
  test("Google Robot OFT returns visual matching 76.0 and variant aggregation 70.2", () => {
    const s = findScores({ backbone: "qwen3vl4b", head: "oft", recipe: "cotrain", benchmark: "simpler_google" });
    expect(s.map((x) => x.value)).toEqual([76.0, 70.2]);
  });
  test("LIBERO Qwen3 OFT average is 96.6 with four suites", () => {
    const [s] = findScores({ backbone: "qwen3vl4b", head: "oft", recipe: "sft", benchmark: "libero" });
    expect(s.value).toBe(96.6);
    expect(s.splits?.length).toBe(4);
  });
  test("Calvin returns both qwengr00t Qwen3 rows", () => {
    const s = findScores({ backbone: "qwen3vl4b", head: "gr00t", recipe: "sft", benchmark: "calvin" });
    expect(s.map((x) => x.value)).toEqual([3.645, 3.757]);
  });
  test("recipe mismatch hides scores", () => {
    expect(findScores({ ...DEFAULT_COMBO, recipe: "sft" }).length).toBe(0);
  });
});
