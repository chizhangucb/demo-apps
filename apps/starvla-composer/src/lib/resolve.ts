import {
  BACKBONES,
  BENCHMARKS,
  CATALOG,
  type CatalogEntry,
  type Combo,
  type RecipeId,
  SCORES,
  type ScoreRecord,
  SRC,
  byId,
} from "./data";

export type SupportStatus =
  | "official_checkpoint_and_score"
  | "official_checkpoint_only"
  | "official_score_only"
  | "framework_supported_no_official_release"
  | "not_supported_or_planned";

export const STATUS_COPY: Record<SupportStatus, { label: string; tone: "green" | "teal" | "amber" | "slate" | "red" }> = {
  official_checkpoint_and_score: { label: "Official checkpoint and score", tone: "green" },
  official_checkpoint_only: { label: "Official checkpoint only", tone: "teal" },
  official_score_only: { label: "Official score only", tone: "amber" },
  framework_supported_no_official_release: { label: "Framework supported, no official release", tone: "slate" },
  not_supported_or_planned: { label: "Not supported or planned", tone: "red" },
};

export interface Note {
  text: string;
  href?: string;
}

export interface Disagreement {
  benchmark: string;
  rows: { value: number; table: string; source: string; steps?: string; checkpoint?: string }[];
}

export interface Resolution {
  status: SupportStatus;
  summary: string;
  checkpoints: CatalogEntry[];
  scores: ScoreRecord[];
  /** Official releases for the same backbone, head and benchmark under another recipe. */
  otherRecipe: { checkpoints: CatalogEntry[]; scores: ScoreRecord[] };
  /** Official repos for this benchmark that use a framework outside the four composer heads. */
  relatedExtra: CatalogEntry[];
  caveats: Note[];
  disagreement: Disagreement | null;
  agreement: { value: number; sources: string[] } | null;
}

/** null recipe means the source is silent: it can stand for SFT or co-training, never RL or cross-embodiment. */
export function recipeMatches(recordRecipe: RecipeId | null | undefined, chosen: RecipeId): boolean {
  if (recordRecipe === null || recordRecipe === undefined) return chosen === "sft" || chosen === "cotrain";
  return recordRecipe === chosen;
}

export function findCheckpoints(c: Combo, ignoreRecipe = false): CatalogEntry[] {
  return CATALOG.filter(
    (e) =>
      e.backbone === c.backbone &&
      e.head === c.head &&
      !!e.benchmarks?.includes(c.benchmark) &&
      (ignoreRecipe || recipeMatches(e.recipe, c.recipe)),
  );
}

export function findScores(c: Combo, ignoreRecipe = false): ScoreRecord[] {
  return SCORES.filter(
    (s) =>
      s.benchmark === c.benchmark &&
      s.head === c.head &&
      s.backbones.includes(c.backbone) &&
      (ignoreRecipe || recipeMatches(s.recipe, c.recipe)),
  );
}

/** Two official tables that report different headline numbers for the same combo. Never reconciled. */
export function findDisagreement(scores: ScoreRecord[]): { disagreement: Disagreement | null; agreement: Resolution["agreement"] } {
  const comparable = scores.filter((s) => s.value !== null && s.benchmark === "simpler_widowx" && s.recipe === "cotrain");
  const tables = new Set(comparable.map((s) => s.table));
  if (comparable.length < 2 || tables.size < 2) return { disagreement: null, agreement: null };
  const values = new Set(comparable.map((s) => s.value));
  if (values.size === 1) {
    return { disagreement: null, agreement: { value: comparable[0].value!, sources: comparable.map((s) => s.source) } };
  }
  return {
    disagreement: {
      benchmark: "SimplerEnv WidowX average",
      rows: comparable.map((s) => ({ value: s.value!, table: s.table, source: s.source, steps: s.steps, checkpoint: s.checkpoint })),
    },
    agreement: null,
  };
}

export function resolveCombo(c: Combo): Resolution {
  const backbone = byId(BACKBONES, c.backbone);
  const bench = byId(BENCHMARKS, c.benchmark);
  const caveats: Note[] = [];

  const checkpoints = findCheckpoints(c);
  const scores = findScores(c);
  const otherRecipe = {
    checkpoints: findCheckpoints(c, true).filter((e) => !checkpoints.includes(e)),
    scores: findScores(c, true).filter((s) => !scores.includes(s)),
  };
  const relatedExtra = CATALOG.filter((e) => e.extraFramework && e.benchmarks?.includes(c.benchmark));

  // Head and backbone constraints from the PLAN.
  let blocked: string | null = null;
  if (bench.level === "planned") {
    blocked = `${bench.label} is unchecked (planned) on the starVLA_dev README benchmark list.`;
  }
  if (backbone.family === "world_model" && c.head === "fast") {
    blocked =
      "The world-model frameworks (WM4A) listed on starVLA_dev are OFT, PI and GR00T variants. There is no WM4A FAST path in this PLAN.";
  }

  if (c.head === "fast") {
    if (backbone.family === "qwen" && c.backbone !== "vlact") {
      caveats.push({
        text: "Official FAST releases use the Action-token VLMs (StarVLA/Qwen2.5-VL-3B-Instruct-Action, StarVLA/Qwen3-VL-4B-Instruct-Action) plus the StarVLA/pi-fast tokenizer, not the plain Instruct model.",
        href: SRC.modelZoo,
      });
    } else {
      caveats.push({
        text: "Official FAST releases use the Qwen Action-token VLMs and the StarVLA/pi-fast tokenizer. Pairing FAST with this backbone is not an official release.",
        href: SRC.modelZoo,
      });
    }
  }
  if (c.recipe === "rl") {
    caveats.push({
      text: "RL adaptation is docs-supported via RLinf but still unchecked on the README recipe list. The 2026-11-24 Hugging Face snapshot has no official RL-adapted StarVLA checkpoint.",
      href: SRC.rlinf,
    });
  }
  if (c.recipe === "xembodiment") {
    caveats.push({ text: "Cross-embodiment co-training is a checked recipe, but this PLAN records no official checkpoint or score labelled with it." });
  }
  if (c.backbone === "qwen35") {
    caveats.push({ text: "Qwen3.5 support landed in news 2026-03-03 (PR 172). No official StarVLA-org Qwen3.5 finetune is in the 45-model snapshot.", href: SRC.qwen35Pr });
  }
  if (c.backbone === "internvl") {
    caveats.push({ text: "InternVL is a homepage brick in the InternVLA-M1 lineage (M1.py). No official StarVLA-org InternVL finetune is in the 45-model snapshot.", href: SRC.internvlaM1 });
  }
  if (c.backbone === "florence2" && c.head !== "gr00t") {
    caveats.push({ text: "The only official Florence-2 release pairs it with the GR00T head. Other Florence-2 pairings are not documented in this PLAN." });
  }
  if (c.benchmark === "robocasa_gr1" || c.benchmark === "robocasa365") {
    caveats.push({ text: "RoboCasa-GR1 (GR1 humanoid, 24 tasks) and RoboCasa365 (PandaOmron, 50 tasks) are different benchmarks. Their checkpoints and scores are not interchangeable." });
  }
  if (bench.level === "example_dev") {
    caveats.push({ text: `${bench.label}: example directory present on starVLA_dev, not on the README checked list.` });
  }
  if (bench.level === "real_robot") {
    caveats.push({ text: "Franka is a real-robot example (news 2026-03-19, PR 198), not a published score table." });
  }
  if (["behavior", "domino", "libero_plus", "robodojo"].includes(c.benchmark)) {
    caveats.push({ text: "No official score for this benchmark is recorded in this PLAN. Checkpoints may still exist." });
  }
  if (checkpoints.some((e) => e.recipe === null)) {
    caveats.push({ text: "The PLAN's sources do not state the training recipe for at least one matching repo; it is shown for SFT and co-training without claiming either." });
  }
  if (scores.length > 0 && checkpoints.length > 0 && scores.some((s) => !s.checkpoint)) {
    caveats.push({ text: "Score rows without a repo link come from a results page that does not name the checkpoint." });
  }

  const { disagreement, agreement } = findDisagreement(scores);

  let status: SupportStatus;
  if (blocked) status = "not_supported_or_planned";
  else if (checkpoints.length && scores.some((s) => s.value !== null)) status = "official_checkpoint_and_score";
  else if (checkpoints.length) status = "official_checkpoint_only";
  else if (scores.some((s) => s.value !== null)) status = "official_score_only";
  else status = "framework_supported_no_official_release";

  const summary = blocked ?? summarize(status, checkpoints.length, scores.length);

  return {
    status,
    summary,
    checkpoints: blocked ? [] : checkpoints,
    scores: blocked ? [] : scores,
    otherRecipe: blocked ? { checkpoints: [], scores: [] } : otherRecipe,
    relatedExtra,
    caveats,
    disagreement: blocked ? null : disagreement,
    agreement: blocked ? null : agreement,
  };
}

function summarize(status: SupportStatus, nCk: number, nSc: number): string {
  switch (status) {
    case "official_checkpoint_and_score":
      return `StarVLA ships ${nCk === 1 ? "an official checkpoint" : `${nCk} official checkpoints`} for this combo, and ${nSc === 1 ? "an official table reports" : `${nSc} official table rows report`} its score.`;
    case "official_checkpoint_only":
      return "An official StarVLA checkpoint matches this combo, but no official score for it is recorded in this PLAN.";
    case "official_score_only":
      return "An official StarVLA table reports a score for this combo, but no matching StarVLA-org repo is in the 2026-11-24 Hugging Face snapshot.";
    case "framework_supported_no_official_release":
      return "The backbone and head exist as StarVLA code paths, but there is neither an official repo nor an official score for this exact combo.";
    default:
      return "Not supported.";
  }
}

export function formatScore(s: ScoreRecord): string {
  if (s.value === null) return "-";
  return s.unit === "len" ? s.value.toFixed(3) : `${s.value}`;
}
