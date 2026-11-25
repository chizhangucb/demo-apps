import coreJson from "@/data/core-results.json";
import aggJson from "@/data/aggregates.json";

export type Mode = "standard" | "privileged" | "realtime";
export type Setting = Mode | "overall";
export const SETTINGS: Setting[] = ["standard", "privileged", "realtime", "overall"];
export const MODES: Mode[] = ["standard", "privileged", "realtime"];

export const SETTING_LABEL: Record<Setting, string> = {
  standard: "Standard",
  privileged: "Privileged",
  realtime: "Realtime",
  overall: "Overall",
};

export type Count = { solved: number; tests: number };

export type Agent = {
  id: string;
  model: string;
  harness: string;
  effort: string;
  label: string;
  scores: Record<Setting, Count>;
};

export type Suite = {
  id: string;
  name: string;
  code: string;
  origin: string;
  body: string;
  page: string;
};

/** One core test. `v` is an S/F string in `agentOrder`. */
export type CoreTest = {
  suite: string;
  id: string;
  title: string;
  setting: Mode;
  v: string;
};

export type Snapshot = {
  date_label: string;
  fetched_at_pt: string;
  site_build_at: string;
  site_commit: string;
  task_set_commit: string;
  task_set_date: string;
  results_window: string;
  leaderboard_footer: string;
  sources: Record<string, string>;
  rule: string;
};

export type PromptCell = Count & { percent_label: string };
export type PromptRow = {
  id: string;
  label: string;
  gpt6_astra: PromptCell;
  fable_5_2: PromptCell;
};

type CoreFile = {
  snapshot: Snapshot;
  agent_order: string[];
  agents: Agent[];
  suites: Suite[];
  tests: CoreTest[];
};

type PairCounts = { n: number; both: number; neither: number } & Record<string, number>;

type AggFile = {
  snapshot: Snapshot;
  agent_order: string[];
  views: Record<Setting, Record<string, Count>>;
  suite_scores: Record<Setting, Record<string, Record<string, Count>>>;
  default_pair: {
    a: string;
    b: string;
    counts: Record<Setting, PairCounts>;
    unsolved_standard_all_11: number;
    unsolved_standard_without_gpt6_2_astra: number;
    note_on_unsolved: string;
    source_for_headline_match: string;
  };
  robodojo_prompt_ablation: {
    source: string;
    also_in_report: string;
    scope: string;
    columns: string[];
    rows: PromptRow[];
  };
};

const core = coreJson as unknown as CoreFile;
export const aggregates = aggJson as unknown as AggFile;

export const snapshot = core.snapshot;
export const agentOrder = core.agent_order;
export const agents = core.agents;
export const suites = core.suites;
export const tests = core.tests;

export const agentById = new Map(agents.map((a) => [a.id, a]));
export const suiteById = new Map(suites.map((s) => [s.id, s]));

export const DEFAULT_A = "codex-gpt6_2_astra-high";
export const DEFAULT_B = "claude_code-fable_5_2-high";
export const DEFAULT_SETTING: Setting = "standard";

export function taskUrl(suite: string, id: string): string {
  return `https://www.embodied-first-exam.ai/tasks/?task=${encodeURIComponent(`${suite}/${id}`)}`;
}

export const SOURCES = {
  bookmark: "https://x.com/ManlingLi_/status/2125300304648470767",
  repo: "https://github.com/mll-lab-nu/embodied-first-exam",
  site: "https://www.embodied-first-exam.ai/",
  leaderboard: "https://www.embodied-first-exam.ai/leaderboard/",
  failureAnalysis: "https://www.embodied-first-exam.ai/blogs/failure-analysis/",
  robodojo: "https://www.embodied-first-exam.ai/suite/robodojo/",
  report: "https://www.embodied-first-exam.ai/blogs/agentic-robotics-benchmark/",
  paper: "https://arxiv.org/abs/2611.12177",
  license: "https://github.com/mll-lab-nu/embodied-first-exam/blob/main/LICENSE",
  siteCommit:
    "https://github.com/Embodied-First-Exam/embodied-first-exam.github.io/commit/b22e17713317e8e0f891dbc39b99ef7748784d09",
  examCommit:
    "https://github.com/mll-lab-nu/embodied-first-exam/tree/258a77cb323f930890cb553e6356f80cb6e6250b",
  examJson: core.snapshot.sources.exam_json,
  tasksJson: core.snapshot.sources.tasks_json,
  hfOlder: core.snapshot.sources.hf_leaderboard_older_snapshot,
} as const;

export const REPO_STATS = { stars: 323, forks: 19, fetched: "2026-11-25, 9:23 AM PT" } as const;
