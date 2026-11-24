// Vendored facts from PLAN.md (fetched 2026-11-24). Never invent scores or Hugging Face ids here.

export const FETCH_DATE = "2026-11-24";

export const SRC = {
  bookmark: "https://x.com/JinhuiYe/status/2122753570730893678",
  repo: "https://github.com/starVLA/starVLA",
  site: "https://starvla.github.io/",
  overview: "https://starvla.github.io/docs/overview/",
  license: "https://github.com/starVLA/starVLA/blob/starVLA/LICENSE",
  hfOrg: "https://huggingface.co/StarVLA",
  arxiv: "https://arxiv.org/abs/2604.05014",
  arxivAlpha: "https://arxiv.org/abs/2604.11757",
  arxivVlact: "https://arxiv.org/abs/2608.27550",
  internvlaM1: "https://github.com/InternRobotics/InternVLA-M1",
  modelZoo: "https://starvla.github.io/docs/model-zoo/",
  simplerenv: "https://starvla.github.io/docs/benchmarks/simplerenv/",
  libero: "https://starvla.github.io/docs/benchmarks/libero/",
  robocasa: "https://starvla.github.io/docs/benchmarks/robocasa/",
  robotwin: "https://starvla.github.io/docs/benchmarks/robotwin/",
  robocasa365:
    "https://github.com/starVLA/starVLA/blob/starVLA_dev/examples/simBenchmarks/Robocasa_365/README.md",
  calvin: "https://github.com/starVLA/starVLA/blob/starVLA_dev/examples/simBenchmarks/calvin/README.md",
  rlinf: "https://rlinf.readthedocs.io/en/latest/rst_source/examples/embodied/starvla.html",
  qwen35Pr: "https://github.com/starVLA/starVLA/pull/172",
} as const;

export const REPO_FACTS = {
  stars: 3975,
  forks: 525,
  openIssues: 62,
  hfModelCount: 45,
  hfDatasetCount: 9,
  homepageCheckpointClaim: "41+",
  stableBranch: { name: "starVLA", sha: "3422b9f2387b6f682cf02802904a77b23ab13afd", date: "2026-05-22" },
  devBranch: { name: "starVLA_dev", sha: "99764f57339d2d5e1e74f075d32066c5edac78ef", date: "2026-11-18" },
};

// ---------- Bricks ----------

export type BackboneId =
  | "qwen25vl3b"
  | "qwen3vl4b"
  | "qwen3vl30b"
  | "qwen35"
  | "internvl"
  | "florence2"
  | "cosmos"
  | "wan22"
  | "vlact";
export type HeadId = "fast" | "oft" | "pi" | "gr00t";
export type RecipeId = "sft" | "cotrain" | "xembodiment" | "rl";
export type BenchmarkId =
  | "simpler_widowx"
  | "simpler_google"
  | "libero"
  | "libero_plus"
  | "robocasa_gr1"
  | "robocasa365"
  | "robotwin2"
  | "domino"
  | "behavior"
  | "calvin"
  | "robodojo"
  | "metaworld"
  | "vla_arena"
  | "vlnce"
  | "evodex"
  | "franka"
  | "so101"
  | "rlbench";

export interface Brick<T extends string> {
  id: T;
  label: string;
  short: string;
  evidence: string;
}

export interface BackboneBrick extends Brick<BackboneId> {
  family: "qwen" | "other_vlm" | "world_model";
}

export const BACKBONES: BackboneBrick[] = [
  { id: "qwen25vl3b", label: "Qwen2.5-VL 3B", short: "Qwen2.5-VL", family: "qwen", evidence: "Base VLM for many official model-zoo checkpoints." },
  { id: "qwen3vl4b", label: "Qwen3-VL 4B", short: "Qwen3-VL", family: "qwen", evidence: "Homepage brick; common official base." },
  { id: "qwen3vl30b", label: "Qwen3-VL 30B-A3B (MoE)", short: "QwenVL-MoE", family: "qwen", evidence: "Homepage \"QwenVL-MoE\"; two official repos." },
  { id: "qwen35", label: "Qwen3.5 (0.8B to 9B)", short: "Qwen3.5", family: "qwen", evidence: "Homepage; news 2026-03-03 and PR 172. No official StarVLA-org finetune in the snapshot." },
  { id: "internvl", label: "InternVL", short: "InternVL", family: "other_vlm", evidence: "Homepage; InternVLA-M1 lineage (M1.py). No official StarVLA-org finetune in the snapshot." },
  { id: "florence2", label: "Florence-2", short: "Florence-2", family: "other_vlm", evidence: "Homepage; one official repo (GR00T head)." },
  { id: "cosmos", label: "Cosmos-Predict2 2B", short: "Cosmos-Predict2", family: "world_model", evidence: "Homepage world-model backbone (WM4A)." },
  { id: "wan22", label: "Wan2.2 5B", short: "Wan2.2", family: "world_model", evidence: "Homepage world-model backbone (WM4A)." },
  { id: "vlact", label: "VLAct Qwen3 pretrain", short: "VLAct", family: "qwen", evidence: "StarVLA/VLAct_Qwen3_Pretrain, drop-in base_vlm for Qwen3-VL-4B recipes (news 2026-08-27)." },
];

export const HEADS: Brick<HeadId>[] = [
  { id: "fast", label: "FAST", short: "QwenFast", evidence: "Autoregressive discrete action tokens via a fast tokenizer, in the style of pi0-FAST." },
  { id: "oft", label: "OFT", short: "QwenOFT", evidence: "Parallel continuous action decoding with an MLP head, in the style of OpenVLA-OFT." },
  { id: "pi", label: "PI (flow)", short: "QwenPI", evidence: "Flow-matching action expert for diffusion-style continuous actions, in the style of pi0." },
  { id: "gr00t", label: "GR00T", short: "QwenGR00T", evidence: "Dual system: VLM as System 2, flow matching as System 1, in the style of GR00T." },
];

export const RECIPES: Brick<RecipeId>[] = [
  { id: "sft", label: "Supervised fine-tuning", short: "SFT", evidence: "Checked on the starVLA_dev README recipe list." },
  { id: "cotrain", label: "Multimodal co-training (Bridge+Fractal)", short: "Co-training", evidence: "Checked on the README list. Official SimplerEnv Bridge+Fractal runs are this kind." },
  { id: "xembodiment", label: "Cross-embodiment co-training", short: "Cross-embodiment", evidence: "Checked on the README list." },
  { id: "rl", label: "RL adaptation (RLinf)", short: "RL", evidence: "Unchecked on the README list; docs-supported via RLinf (news 2026-04-09)." },
];

export type BenchmarkLevel = "checked" | "example_dev" | "real_robot" | "planned";

export interface BenchmarkBrick extends Brick<BenchmarkId> {
  level: BenchmarkLevel;
}

export const BENCHMARKS: BenchmarkBrick[] = [
  { id: "simpler_widowx", label: "SimplerEnv WidowX", short: "WidowX", level: "checked", evidence: "SimplerEnv is checked on the README. Bridge tasks on the WidowX arm." },
  { id: "simpler_google", label: "SimplerEnv Google Robot", short: "Google Robot", level: "checked", evidence: "SimplerEnv is checked on the README. Fractal tasks on Google RT-1." },
  { id: "libero", label: "LIBERO", short: "LIBERO", level: "checked", evidence: "4 suites, 40 tasks, Franka arm." },
  { id: "libero_plus", label: "LIBERO-plus", short: "LIBERO-plus", level: "checked", evidence: "Checked on the README." },
  { id: "robocasa_gr1", label: "RoboCasa-GR1 tabletop", short: "RoboCasa-GR1", level: "checked", evidence: "24 tasks, Fourier GR1 humanoid, dual arms. Not interchangeable with RoboCasa365." },
  { id: "robocasa365", label: "RoboCasa365", short: "RoboCasa365", level: "checked", evidence: "50 tasks, PandaOmron mobile single arm. Not interchangeable with RoboCasa-GR1." },
  { id: "robotwin2", label: "RoboTwin 2.0", short: "RoboTwin", level: "checked", evidence: "50 tasks, Easy and Hard." },
  { id: "domino", label: "DOMINO", short: "DOMINO", level: "checked", evidence: "Checked on the README." },
  { id: "behavior", label: "BEHAVIOR", short: "BEHAVIOR", level: "checked", evidence: "Checked on the README; docs page was still under active development." },
  { id: "calvin", label: "Calvin", short: "Calvin", level: "checked", evidence: "Checked on the README; results by the UNT team." },
  { id: "robodojo", label: "RoboDojo", short: "RoboDojo", level: "checked", evidence: "Checked on the README." },
  { id: "metaworld", label: "MetaWorld", short: "MetaWorld", level: "example_dev", evidence: "Example present on starVLA_dev, not on the README checked list." },
  { id: "vla_arena", label: "VLA-Arena", short: "VLA-Arena", level: "example_dev", evidence: "Example present on starVLA_dev, not on the README checked list." },
  { id: "vlnce", label: "VLN-CE", short: "VLN-CE", level: "example_dev", evidence: "Example present on starVLA_dev, not on the README checked list." },
  { id: "evodex", label: "Evo-DexBench", short: "Evo-DexBench", level: "example_dev", evidence: "Example present on starVLA_dev, not on the README checked list." },
  { id: "franka", label: "Franka (real)", short: "Franka", level: "real_robot", evidence: "Real-robot example (news 2026-03-19, PR 198). No published score table." },
  { id: "so101", label: "SO101", short: "SO101", level: "planned", evidence: "Unchecked (planned) on the README list." },
  { id: "rlbench", label: "RLBench", short: "RLBench", level: "planned", evidence: "Unchecked (planned) on the README list." },
];

// ---------- Hugging Face catalog (45 official model ids, 2026-11-24) ----------

export type CatalogGroup =
  | "Modified / tokenizer"
  | "SimplerEnv / Bridge"
  | "LIBERO"
  | "RoboCasa GR1"
  | "RoboTwin"
  | "BEHAVIOR"
  | "RoboDojo"
  | "VLAct";

export interface CatalogEntry {
  id: string; // exact Hugging Face id, never "fixed"
  group: CatalogGroup;
  backbone?: BackboneId;
  head?: HeadId;
  /** Recipe the PLAN attributes; null means the PLAN's sources are silent (matches SFT or co-training). */
  recipe?: RecipeId | null;
  benchmarks?: BenchmarkId[];
  /** Framework name when it is not one of the four composer heads. */
  extraFramework?: string;
  note?: string;
  downloads?: number;
  likes?: number;
}

const BRIDGE_RT1: BenchmarkId[] = ["simpler_widowx", "simpler_google"];

export const CATALOG: CatalogEntry[] = [
  { id: "StarVLA/Qwen2.5-VL-3B-Instruct-Action", group: "Modified / tokenizer", backbone: "qwen25vl3b", note: "Action-token VLM used by official FAST releases.", downloads: 158, likes: 1 },
  { id: "StarVLA/Qwen3-VL-4B-Instruct-Action", group: "Modified / tokenizer", backbone: "qwen3vl4b", note: "Action-token VLM used by official FAST releases.", downloads: 1691, likes: 3 },
  { id: "StarVLA/pi-fast", group: "Modified / tokenizer", head: "fast", note: "FAST tokenizer weights.", downloads: 0, likes: 0 },

  { id: "StarVLA/Qwen-FAST-Bridge-RT-1", group: "SimplerEnv / Bridge", backbone: "qwen25vl3b", head: "fast", recipe: "cotrain", benchmarks: BRIDGE_RT1 },
  { id: "StarVLA/Qwen-OFT-Bridge-RT-1", group: "SimplerEnv / Bridge", backbone: "qwen25vl3b", head: "oft", recipe: "cotrain", benchmarks: BRIDGE_RT1 },
  { id: "StarVLA/Qwen-GR00T-Bridge-RT-1", group: "SimplerEnv / Bridge", backbone: "qwen25vl3b", head: "gr00t", recipe: "cotrain", benchmarks: BRIDGE_RT1 },
  { id: "StarVLA/Qwen-PI-Bridge-RT-1", group: "SimplerEnv / Bridge", backbone: "qwen25vl3b", head: "pi", recipe: "cotrain", benchmarks: BRIDGE_RT1 },
  { id: "StarVLA/Qwen-GR00T-Bridge", group: "SimplerEnv / Bridge", backbone: "qwen25vl3b", head: "gr00t", recipe: "sft", benchmarks: ["simpler_widowx"], note: "Bridge only. The zoo row name does not state the Qwen version; it is listed with the Qwen2.5 rows." },
  { id: "StarVLA/Qwen3VL-OFT-Bridge-RT-1", group: "SimplerEnv / Bridge", backbone: "qwen3vl4b", head: "oft", recipe: "cotrain", benchmarks: BRIDGE_RT1 },
  { id: "StarVLA/Qwen3VL-GR00T-Bridge-RT-1", group: "SimplerEnv / Bridge", backbone: "qwen3vl4b", head: "gr00t", recipe: "cotrain", benchmarks: BRIDGE_RT1 },
  { id: "StarVLA/Florence-GR00T-Bridge-RT-1", group: "SimplerEnv / Bridge", backbone: "florence2", head: "gr00t", recipe: "cotrain", benchmarks: BRIDGE_RT1 },
  { id: "StarVLA/Qwen3VL-PI_v3-Bridge-RT_1", group: "SimplerEnv / Bridge", backbone: "qwen3vl4b", head: "pi", recipe: "cotrain", benchmarks: BRIDGE_RT1, note: "QwenPI_v3 framework." },
  { id: "StarVLA/Qwen3-VL-30B-A3B-OFT-Bridge-RT1", group: "SimplerEnv / Bridge", backbone: "qwen3vl30b", head: "oft", recipe: "cotrain", benchmarks: BRIDGE_RT1 },
  { id: "StarVLA/Wan2.2-5B-PI-SIMPLE", group: "SimplerEnv / Bridge", backbone: "wan22", head: "pi", recipe: null, benchmarks: BRIDGE_RT1 },
  { id: "StarVLA/Qwen3-VL-4B-PI-SIMPLE", group: "SimplerEnv / Bridge", backbone: "qwen3vl4b", head: "pi", recipe: null, benchmarks: BRIDGE_RT1 },

  { id: "StarVLA/Qwen2.5-VL-FAST-LIBERO-4in1", group: "LIBERO", backbone: "qwen25vl3b", head: "fast", recipe: "sft", benchmarks: ["libero"] },
  { id: "StarVLA/Qwen2.5-VL-OFT-LIBERO-4in1", group: "LIBERO", backbone: "qwen25vl3b", head: "oft", recipe: "sft", benchmarks: ["libero"] },
  { id: "StarVLA/Qwen2.5-VL-GR00T-LIBERO-4in1", group: "LIBERO", backbone: "qwen25vl3b", head: "gr00t", recipe: "sft", benchmarks: ["libero"] },
  { id: "StarVLA/Qwen3-VL-OFT-LIBERO-4in1", group: "LIBERO", backbone: "qwen3vl4b", head: "oft", recipe: "sft", benchmarks: ["libero"] },
  { id: "StarVLA/Qwen3-VL-PI-LIBERO-4in1", group: "LIBERO", backbone: "qwen3vl4b", head: "pi", recipe: "sft", benchmarks: ["libero"] },
  { id: "StarVLA/Qwen3-VL-30B-A3B-OFT-LIBERO", group: "LIBERO", backbone: "qwen3vl30b", head: "oft", recipe: "sft", benchmarks: ["libero"] },
  { id: "StarVLA/WM4A-CosmoPredict-GR00T-LIBERO-4in1", group: "LIBERO", backbone: "cosmos", head: "gr00t", recipe: "sft", benchmarks: ["libero"] },
  { id: "StarVLA/WM4A-Wan2d2-OFT-LIBERO-4in1", group: "LIBERO", backbone: "wan22", head: "oft", recipe: "sft", benchmarks: ["libero"] },

  { id: "StarVLA/Qwen3-VL-GR00T-Robocasa-gr1", group: "RoboCasa GR1", backbone: "qwen3vl4b", head: "gr00t", recipe: "sft", benchmarks: ["robocasa_gr1"] },
  { id: "StarVLA/Qwen3-VL-OFT-Robocasa", group: "RoboCasa GR1", backbone: "qwen3vl4b", head: "oft", recipe: "sft", benchmarks: ["robocasa_gr1"] },

  { id: "StarVLA/Qwen3-VL-OFT-Robotwin2", group: "RoboTwin", backbone: "qwen3vl4b", head: "oft", recipe: "sft", benchmarks: ["robotwin2"] },
  { id: "StarVLA/Qwen3-VL-OFT-RoboTwin2-All", group: "RoboTwin", backbone: "qwen3vl4b", head: "oft", recipe: "sft", benchmarks: ["robotwin2"], note: "Capitalization differs from the other RoboTwin repo." },

  { id: "StarVLA/BEHAVIOR-qwendual-state-tast1-chunck50-BEHAVIOR-rgp-seg", group: "BEHAVIOR", extraFramework: "QwenDual", benchmarks: ["behavior"] },
  { id: "StarVLA/1115_BEHAVIOR_rgp_dual_QwenDual_task6_40k", group: "BEHAVIOR", extraFramework: "QwenDual", benchmarks: ["behavior"] },
  { id: "StarVLA/1117_BEHAVIOR_challenge_QwenDual_task1", group: "BEHAVIOR", extraFramework: "QwenDual", benchmarks: ["behavior"] },
  { id: "StarVLA/1120_BEHAVIOR_challenge_QwenDual_taskall", group: "BEHAVIOR", extraFramework: "QwenDual", benchmarks: ["behavior"] },

  { id: "StarVLA/StarVLA-Qwen3vl4b-PIv3-RoboDojo", group: "RoboDojo", backbone: "qwen3vl4b", head: "pi", recipe: "sft", benchmarks: ["robodojo"] },
  { id: "StarVLA/Qwen3vl4b-GR00T-RoboDojo", group: "RoboDojo", backbone: "qwen3vl4b", head: "gr00t", recipe: "sft", benchmarks: ["robodojo"] },
  { id: "StarVLA/Qwen3vl4b-OFT-RoboDojo", group: "RoboDojo", backbone: "qwen3vl4b", head: "oft", recipe: "sft", benchmarks: ["robodojo"] },
  { id: "StarVLA/VLAct-Qwen3VL4B-OFT-RoboDojo", group: "RoboDojo", backbone: "vlact", head: "oft", recipe: "sft", benchmarks: ["robodojo"] },

  { id: "StarVLA/VLAct_Qwen3_Pretrain", group: "VLAct", backbone: "vlact", note: "Pretrained backbone, drop-in base_vlm." },
  { id: "StarVLA/VLAct_Qwen3GR00T_Robotwin_Finetune", group: "VLAct", backbone: "vlact", head: "gr00t", recipe: "sft", benchmarks: ["robotwin2"] },
  { id: "StarVLA/VLAct_Qwen3OFT_Domino_Finetune", group: "VLAct", backbone: "vlact", head: "oft", recipe: "sft", benchmarks: ["domino"] },
  { id: "StarVLA/VLAct_Qwen3OFT_Robotwin_Finetune", group: "VLAct", backbone: "vlact", head: "oft", recipe: "sft", benchmarks: ["robotwin2"] },
  { id: "StarVLA/VLAct_Qwen3PI_Libero_Plus_Finetune", group: "VLAct", backbone: "vlact", head: "pi", recipe: "sft", benchmarks: ["libero_plus"] },
  { id: "StarVLA/VLAct_Qwen3OFT_Robotwin_all_Finetune", group: "VLAct", backbone: "vlact", head: "oft", recipe: "sft", benchmarks: ["robotwin2"] },
  { id: "StarVLA/VLAct_Qwen3PI_Robotwin_Finetune", group: "VLAct", backbone: "vlact", head: "pi", recipe: "sft", benchmarks: ["robotwin2"] },
  { id: "StarVLA/VLAct_Qwen3PI_VLA_Arena_Finetune", group: "VLAct", backbone: "vlact", head: "pi", recipe: "sft", benchmarks: ["vla_arena"] },
  { id: "StarVLA/VLAct_Qwen3PI_Robotwin_all_Finetune", group: "VLAct", backbone: "vlact", head: "pi", recipe: "sft", benchmarks: ["robotwin2"] },
  { id: "StarVLA/VLAct_Qwen3GR00T_Robotwin_all_Finetune", group: "VLAct", backbone: "vlact", head: "gr00t", recipe: "sft", benchmarks: ["robotwin2"] },
];

export const DATASETS = [
  "StarVLA/BEHAVIOR-1K",
  "StarVLA/BEHAVIOR-1K-datasets",
  "StarVLA/BEHAVIOR-1K-datasets-assets",
  "StarVLA/BEHAVIOR-1K-VISUALIZATION-DEMO",
  "StarVLA/LLaVA-OneVision-COCO",
  "StarVLA/behavior-1k-task0",
  "StarVLA/RoboTwin-Clean",
  "StarVLA/RoboTwin-Randomized",
  "StarVLA/RoboTwin-Randomized-targz",
];

// ---------- Published scores ----------

export interface ScoreRecord {
  key: string;
  benchmark: BenchmarkId;
  /** Backbones this row applies to. More than one only when the source does not name the size. */
  backbones: BackboneId[];
  head: HeadId;
  recipe: RecipeId | null;
  rowLabel: string;
  table: string; // which official table
  source: string;
  sourceLabel: string;
  metric: string; // name of the headline metric
  value: number | null; // headline; null means the source shows "-"
  unit: "%" | "len";
  steps?: string;
  splits?: { label: string; value: string }[];
  /** Exact HF id when the source row names it. */
  checkpoint?: string;
  caveat?: string;
}

const W_TASKS = ["Spoon on towel", "Carrot on plate", "Stack blocks", "Eggplant in basket"];
const G_TASKS = ["Pick coke can", "Move near", "Open/close drawer", "Top drawer + apple"];
const L_SUITES = ["Spatial", "Object", "Goal", "Long"];
const C_TASKS = ["Task 1", "Task 2", "Task 3", "Task 4", "Task 5"];

const splits = (labels: string[], vals: (number | string)[], suffix = "") =>
  labels.map((label, i) => ({ label, value: `${typeof vals[i] === "number" ? (vals[i] as number).toFixed(1) : vals[i]}${suffix}` }));

const widowxEval = (
  backbone: BackboneId,
  head: HeadId,
  name: string,
  steps: string,
  vals: number[],
  avg: number,
): ScoreRecord => ({
  key: `simpler-eval-${head}-${backbone}`,
  benchmark: "simpler_widowx",
  backbones: [backbone],
  head,
  recipe: "cotrain",
  rowLabel: name,
  table: "SimplerEnv eval page, WidowX visual matching",
  source: SRC.simplerenv,
  sourceLabel: "starvla.github.io SimplerEnv",
  metric: "Average success",
  value: avg,
  unit: "%",
  steps,
  splits: splits(W_TASKS, vals),
});

const zoo = (
  backbone: BackboneId,
  head: HeadId,
  recipe: RecipeId,
  name: string,
  value: number | null,
  checkpoint: string,
  caveat?: string,
): ScoreRecord => ({
  key: `zoo-${checkpoint}`,
  benchmark: "simpler_widowx",
  backbones: [backbone],
  head,
  recipe,
  rowLabel: name,
  table: "Model zoo, WidowX column",
  source: SRC.modelZoo,
  sourceLabel: "starvla.github.io Model zoo",
  metric: "WidowX success",
  value,
  unit: "%",
  checkpoint,
  caveat,
});

const liberoRow = (backbone: BackboneId, head: HeadId, name: string, vals: number[], avg: number): ScoreRecord => ({
  key: `libero-${head}-${backbone}`,
  benchmark: "libero",
  backbones: [backbone],
  head,
  recipe: "sft",
  rowLabel: name,
  table: "LIBERO, one policy on all 4 suites, 500 trials per suite",
  source: SRC.libero,
  sourceLabel: "starvla.github.io LIBERO",
  metric: "Average success",
  value: avg,
  unit: "%",
  steps: "30K (9.54 epochs)",
  splits: splits(L_SUITES, vals),
});

const gr1Row = (head: HeadId, name: string, avg: number): ScoreRecord => ({
  key: `gr1-${head}`,
  benchmark: "robocasa_gr1",
  backbones: ["qwen3vl4b"],
  head,
  recipe: "sft",
  rowLabel: name,
  table: "RoboCasa GR1 tabletop, 24 tasks, 50 rollouts per task",
  source: SRC.robocasa,
  sourceLabel: "starvla.github.io RoboCasa",
  metric: "Average success",
  value: avg,
  unit: "%",
});

const RC365_CAVEAT =
  "Local research snapshot dated 2026-08-30 (RoboCasa v1.0.1). Not official RoboCasa leaderboard submissions and cannot be reproduced from the README alone; checkpoints and raw logs are not checked in. The README does not name the backbone size in this PLAN, so the row is shown for both Qwen VL backbones.";

const rc365Row = (key: string, head: HeadId, name: string, overall: string, s: string[], caveat = RC365_CAVEAT): ScoreRecord => ({
  key: `rc365-${key}`,
  benchmark: "robocasa365",
  backbones: ["qwen25vl3b", "qwen3vl4b"],
  head,
  recipe: "sft",
  rowLabel: name,
  table: "RoboCasa365 local snapshot, 50 tasks x 50 rollouts",
  source: SRC.robocasa365,
  sourceLabel: "starVLA_dev Robocasa_365 README",
  metric: "Overall success",
  value: parseFloat(overall),
  unit: "%",
  splits: [
    { label: "Overall", value: overall },
    { label: "Atomic-Seen", value: s[0] },
    { label: "Composite-Seen", value: s[1] },
    { label: "Composite-Unseen", value: s[2] },
  ],
  caveat,
});

const calvinRow = (backbone: BackboneId, head: HeadId, name: string, len: number, vals: string[]): ScoreRecord => ({
  key: `calvin-${head}-${name}`,
  benchmark: "calvin",
  backbones: [backbone],
  head,
  recipe: "sft",
  rowLabel: name,
  table: "Calvin benchmark results (UNT team)",
  source: SRC.calvin,
  sourceLabel: "starVLA_dev calvin README",
  metric: "Avg. length",
  value: len,
  unit: "len",
  splits: splits(C_TASKS, vals),
  caveat: "README: \"Other experimental results will be released soon.\" No Calvin repo is in the 45-model snapshot.",
});

export const SCORES: ScoreRecord[] = [
  widowxEval("qwen3vl4b", "fast", "StarVLA-FAST (Qwen3-VL)", "15K", [18.8, 31.3, 4.2, 71.9], 31.6),
  widowxEval("qwen3vl4b", "oft", "StarVLA-OFT (Qwen3-VL)", "65K", [90.3, 38.5, 29.7, 100.0], 64.6),
  widowxEval("qwen3vl4b", "pi", "StarVLA-PI (Qwen3-VL)", "40K", [78.1, 46.9, 30.2, 88.5], 60.9),
  widowxEval("qwen3vl4b", "gr00t", "StarVLA-GR00T (Qwen3-VL)", "20K", [83.0, 59.4, 18.8, 100.0], 65.3),
  widowxEval("cosmos", "oft", "StarVLA-OFT (Cosmos-Predict2-2B)", "30K", [66.8, 62.6, 25.3, 90.2], 61.2),
  widowxEval("cosmos", "pi", "StarVLA-PI (Cosmos-Predict2-2B)", "30K", [81.4, 55.2, 25.1, 73.0], 58.7),
  widowxEval("cosmos", "gr00t", "StarVLA-GR00T (Cosmos-Predict2-2B)", "30K", [80.4, 65.4, 20.0, 80.6], 61.6),

  zoo("qwen25vl3b", "fast", "cotrain", "Qwen2.5-FAST-Bridge-RT-1", 58.6, "StarVLA/Qwen-FAST-Bridge-RT-1"),
  zoo("qwen25vl3b", "oft", "cotrain", "Qwen2.5-OFT-Bridge-RT-1", 41.8, "StarVLA/Qwen-OFT-Bridge-RT-1"),
  zoo("qwen25vl3b", "pi", "cotrain", "Qwen2.5-PI-Bridge-RT-1", 62.5, "StarVLA/Qwen-PI-Bridge-RT-1"),
  zoo("qwen25vl3b", "gr00t", "cotrain", "Qwen2.5-GR00T-Bridge-RT-1", 63.6, "StarVLA/Qwen-GR00T-Bridge-RT-1"),
  zoo("qwen25vl3b", "gr00t", "sft", "Qwen-GR00T-Bridge (Bridge only)", 71.4, "StarVLA/Qwen-GR00T-Bridge"),
  zoo("qwen3vl4b", "oft", "cotrain", "Qwen3VL-OFT-Bridge-RT-1", 42.7, "StarVLA/Qwen3VL-OFT-Bridge-RT-1"),
  zoo("qwen3vl4b", "gr00t", "cotrain", "Qwen3VL-GR00T-Bridge-RT-1", 65.3, "StarVLA/Qwen3VL-GR00T-Bridge-RT-1"),
  zoo("florence2", "gr00t", "cotrain", "Florence-GR00T-Bridge-RT-1", null, "StarVLA/Florence-GR00T-Bridge-RT-1", "The model zoo shows \"-\" for this row: no WidowX score is published there."),

  {
    key: "google-vm-oft",
    benchmark: "simpler_google",
    backbones: ["qwen3vl4b"],
    head: "oft",
    recipe: "cotrain",
    rowLabel: "StarVLA-OFT, visual matching",
    table: "SimplerEnv eval page, Google Robot visual matching",
    source: SRC.simplerenv,
    sourceLabel: "starvla.github.io SimplerEnv",
    metric: "Average success",
    value: 76.0,
    unit: "%",
    splits: splits(G_TASKS, [95.3, 75.0, 68.8, 66.1]),
    caveat: "All StarVLA Google Robot results use Qwen3-VL-4B; only StarVLA-OFT is reported.",
  },
  {
    key: "google-va-oft",
    benchmark: "simpler_google",
    backbones: ["qwen3vl4b"],
    head: "oft",
    recipe: "cotrain",
    rowLabel: "StarVLA-OFT, variant aggregation",
    table: "SimplerEnv eval page, Google Robot variant aggregation",
    source: SRC.simplerenv,
    sourceLabel: "starvla.github.io SimplerEnv",
    metric: "Average success",
    value: 70.2,
    unit: "%",
    splits: splits(G_TASKS, [91.3, 75.1, 55.0, 59.4]),
  },

  liberoRow("qwen25vl3b", "fast", "StarVLA-FAST (Qwen2.5-VL)", [97.3, 97.2, 96.1, 90.2], 95.2),
  liberoRow("qwen25vl3b", "oft", "StarVLA-OFT (Qwen2.5-VL)", [97.4, 98.0, 96.8, 92.0], 96.1),
  liberoRow("qwen25vl3b", "pi", "StarVLA-PI (Qwen2.5-VL)", [98.2, 99.2, 95.6, 88.4], 95.4),
  liberoRow("qwen25vl3b", "gr00t", "StarVLA-GR00T (Qwen2.5-VL)", [97.8, 98.2, 94.6, 90.8], 95.4),
  liberoRow("qwen3vl4b", "fast", "StarVLA-FAST (Qwen3-VL)", [97.3, 97.4, 96.3, 90.6], 95.4),
  liberoRow("qwen3vl4b", "oft", "StarVLA-OFT (Qwen3-VL)", [97.8, 98.6, 96.2, 93.8], 96.6),
  liberoRow("qwen3vl4b", "pi", "StarVLA-PI (Qwen3-VL)", [98.8, 99.6, 95.8, 88.4], 95.7),
  liberoRow("qwen3vl4b", "gr00t", "StarVLA-GR00T (Qwen3-VL)", [97.8, 98.8, 97.4, 92.0], 96.5),

  gr1Row("gr00t", "StarVLA-GR00T-Qwen3", 47.8),
  gr1Row("pi", "StarVLA-PI-Qwen3", 43.9),
  gr1Row("oft", "StarVLA-OFT-Qwen3", 48.8),
  gr1Row("fast", "StarVLA-FAST-Qwen3", 39.0),

  {
    key: "robotwin-oft",
    benchmark: "robotwin2",
    backbones: ["qwen3vl4b"],
    head: "oft",
    recipe: "sft",
    rowLabel: "StarVLA-OFT",
    table: "RoboTwin 2.0, 50 tasks in one model",
    source: SRC.robotwin,
    sourceLabel: "starvla.github.io RoboTwin",
    metric: "Easy average",
    value: 88.18,
    unit: "%",
    splits: [
      { label: "Easy", value: "88.18" },
      { label: "Hard", value: "88.32" },
    ],
    caveat:
      "Trained on 50 clean and 500 randomized demos per task. The results page does not say which of the two official OFT RoboTwin repos produced these averages, and it does not name the backbone; the official OFT RoboTwin repos are Qwen3-VL. These averages do not apply to VLAct cards.",
  },

  rc365Row("oft", "oft", "StarVLA-OFT", "33.32", ["65.22", "15.62", "15.12"]),
  rc365Row("oft-nostate", "oft", "StarVLA-OFT (no state)", "30.92", ["63.78", "13.50", "11.38"]),
  rc365Row("pi", "pi", "StarVLA-PI (best selected local result)", "40.64", ["76.56", "39.38", "1.50"]),
  rc365Row("gr00t", "gr00t", "StarVLA-GR00T", "39.24", ["76.67", "35.38", "1.00"]),

  calvinRow("qwen25vl3b", "pi", "qwenpi (qwen2.5-vl-3B-instruct-action)", 3.576, ["90.9%", "79.5%", "69.6%", "62.2%", "55.4%"]),
  calvinRow("qwen3vl4b", "pi", "qwenpi (qwen3-vl-4B-instruct)", 3.472, ["87.7%", "75.2%", "67.4%", "61.8%", "55.1%"]),
  calvinRow("qwen25vl3b", "gr00t", "qwengr00t (qwen2.5-vl-3B-instruct)", 3.697, ["91.7%", "81.9%", "72.7%", "65.3%", "58.1%"]),
  calvinRow("qwen25vl3b", "gr00t", "qwengr00t (qwen2.5-vl-3B-instruct-action)", 3.786, ["92.5%", "83.9%", "74.4%", "67.9%", "59.9%"]),
  calvinRow("qwen3vl4b", "gr00t", "qwengr00t (qwen3-vl-4B-instruct)", 3.645, ["89.8%", "79.9%", "71.8%", "64.9%", "58.1%"]),
  calvinRow("qwen3vl4b", "gr00t", "qwengr00t (qwen3-vl-4B-instruct-action)", 3.757, ["91.1%", "81.8%", "74.1%", "67.6%", "61.1%"]),
];

/** Non-StarVLA comparison rows printed on the same official tables. */
export const COMPARISONS: Partial<Record<BenchmarkId, { label: string; value: string }[]>> = {
  libero: [
    { label: "pi0+FAST", value: "85.5" },
    { label: "OpenVLA-OFT", value: "97.1" },
    { label: "pi0", value: "94.1" },
    { label: "GR00T-N1.5", value: "86.5" },
  ],
  robocasa_gr1: [{ label: "GR00T-N1.6 (baseline)", value: "47.6" }],
  robotwin2: [
    { label: "pi0", value: "65.92 / 58.40" },
    { label: "pi0.5", value: "82.74 / 76.76" },
    { label: "X-VLA", value: "72.80 / 72.84" },
    { label: "Motus", value: "88.66 / 87.02" },
    { label: "lingbot-vla (no depth)", value: "86.50 / 85.34" },
    { label: "lingbot-vla (depth)", value: "88.56 / 86.68" },
  ],
  calvin: [
    { label: "PI0*", value: "2.954" },
    { label: "PI0.5*", value: "3.885" },
  ],
};

export const DEFAULT_COMBO = {
  backbone: "qwen3vl4b" as BackboneId,
  head: "gr00t" as HeadId,
  recipe: "cotrain" as RecipeId,
  benchmark: "simpler_widowx" as BenchmarkId,
};

export type Combo = typeof DEFAULT_COMBO;

export const byId = <T extends { id: string }>(list: T[], id: string) => list.find((x) => x.id === id)!;
