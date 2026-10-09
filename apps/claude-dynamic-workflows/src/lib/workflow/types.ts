// Shared by the server runtime and the browser: task data shape and the SSE event union.

export type ModelAlias = "haiku" | "sonnet" | "opus";

export interface JudgeItem {
  subject: string;
  verdict: string;
  ok: boolean;
  note?: string;
}

export interface JudgeView {
  rubric: string;
  items: JudgeItem[];
  pick?: string;
}

export interface LaneData {
  model?: ModelAlias;
  role?: "worker" | "judge";
  context: string;
  tokens: number;
  text: string;
  result: unknown;
  judge?: JudgeView;
  /** Output stalls once and the agent restarts, shown as (retry 1). */
  retry?: boolean;
  /** Unrecoverable error: agent() resolves to null. */
  fail?: boolean;
}

export interface LaneRule {
  match: string;
  kind: "pairwise" | "rank";
  context: string;
  tokens: number;
}

export interface Tournament {
  rubric: string;
  ranking: string[];
  reasons: Record<string, string>;
}

export type MarkerKind = "early_stop" | "self_grade" | "compaction" | "drift";

export interface BaselineMarker {
  kind: MarkerKind;
  title: string;
  detail: string;
}

export interface BaselineStep {
  text: string;
  tokens: number;
  drift?: boolean;
  coverage?: [number, number];
  /** After a compaction the context holds only this many tokens of summary. */
  contextAfter?: number;
  marker?: BaselineMarker;
}

export interface ComparisonRow {
  metric: string;
  workflow: string;
  baseline: string;
  workflowOk: boolean;
  baselineOk: boolean;
}

export interface TaskData {
  id: string;
  title: string;
  pattern: string;
  blurb: string;
  prompt: string;
  constraint: string;
  args: Record<string, unknown>;
  inputs: { label: string; value: string }[];
  script: string;
  plan: { title: string; agents: number }[];
  lanes: Record<string, LaneData>;
  rules?: LaneRule[];
  tournament?: Tournament;
  baseline: { model: ModelAlias; window: number; steps: BaselineStep[] };
  comparison: { rows: ComparisonRow[]; workflowAnswer: string; baselineAnswer: string };
}

export interface TaskView extends TaskData {
  source: string;
  meta: { name: string; description: string; phases?: { title: string }[] };
}

export type RunEvent =
  | { type: "run_start"; taskId: string; mode: "scripted"; name: string }
  | { type: "phase"; title: string }
  | { type: "log"; message: string; phase: string | null }
  | {
      type: "agent_start";
      id: string;
      label: string;
      model: ModelAlias;
      phase: string | null;
      isolation: string | null;
      role: "worker" | "judge";
      context: string;
      prompt: string;
    }
  | { type: "agent_delta"; id: string; text: string; tokens: number }
  | { type: "agent_retry"; id: string; attempt: number }
  | { type: "agent_done"; id: string; result: unknown; tokens: number; ms: number }
  | { type: "judge"; id: string; label: string; rubric: string; items: JudgeItem[]; pick?: string }
  | { type: "baseline_delta"; text: string; tokens: number; drift: boolean; context: number; coverage?: [number, number] }
  | { type: "baseline_marker"; kind: MarkerKind; title: string; detail: string; context: number }
  | { type: "baseline_done"; tokens: number; ms: number }
  | { type: "run_done"; workflow: { agents: number; tokens: number; ms: number; result: unknown }; baseline: { tokens: number; ms: number } }
  | { type: "error"; message: string };

export const MODEL_NAMES: Record<ModelAlias, string> = { haiku: "Haiku", sonnet: "Sonnet", opus: "Opus" };
