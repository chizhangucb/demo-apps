/** One event in an agent run timeline (Hermes-shaped: think → call a tool → observe → answer). */
export type StepKind = "think" | "tool" | "observe" | "answer" | "skill";

export interface RunStep {
  kind: StepKind;
  /** Short label shown in the timeline row. */
  label: string;
  /** Detail line: tool args, observation excerpt, or reasoning. */
  detail: string;
  /** Tool name for `tool` steps (simulated, never executed). */
  tool?: string;
  /** 1-based index of the skill step this event applies, when the run reuses a skill. */
  skillStep?: number;
  /** True for a dead end the agent backs out of (the cost a skill removes). */
  wasted?: boolean;
  /** Rough token cost for the scoreboard. */
  tokens: number;
}

/** A distilled, reusable procedure — rendered as a Hermes-style SKILL.md. */
export interface Skill {
  name: string;
  description: string;
  /** When the agent should load this skill. */
  trigger: string;
  tools: string[];
  steps: string[];
  /** Pitfalls learned from dead ends in the source run. */
  pitfalls: string[];
}

export interface TaskRun {
  title: string;
  prompt: string;
  steps: RunStep[];
  outcome: string;
}

export interface TaskPair {
  id: string;
  domain: string;
  /** The multi-step task the skill is learned from. */
  learn: TaskRun;
  /** What the harness extracts after `learn` finishes. */
  skill: Skill;
  /** The related follow-up task. */
  reuse: {
    title: string;
    prompt: string;
    /** Run with the extracted skill loaded. */
    warm: RunStep[];
    /** Same task from a cold start (no skill), for comparison. */
    cold: RunStep[];
    outcome: string;
  };
}

export interface RunStats {
  steps: number;
  toolCalls: number;
  wasted: number;
  tokens: number;
}

/* ---- Live API (/api/loop) ---- */

export interface LiveRunRequest {
  phase: "run";
  prompt: string;
  skill?: Skill;
}
export interface LiveRunResponse {
  steps: RunStep[];
  outcome: string;
  tokens: number;
}

export interface LiveExtractRequest {
  phase: "extract";
  prompt: string;
  steps: RunStep[];
  outcome: string;
}
export interface LiveExtractResponse {
  skill: Skill;
  tokens: number;
}
