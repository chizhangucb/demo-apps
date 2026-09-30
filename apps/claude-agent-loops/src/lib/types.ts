export type LoopType = "turn" | "goal" | "time" | "proactive";
export type Mode = "scripted" | "live";

/** One scripted attempt in a canned task. The harness replays these in order. */
export interface ScriptedStep {
  /** Proactive loops: the event that wakes the agent. */
  trigger?: string;
  /** Proactive loops: idle watch ticks (no trigger) before this event arrives. */
  idleBefore?: number;
  /** What the environment looks like at this tick (fed to the live agent too). */
  observation?: string;
  /** Short summary of what the agent did this turn. */
  act: string;
  /** The artifact the agent produced; the verifier checks this. */
  output: string;
  /** Simulated tokens spent on this turn. */
  tokens: number;
  /** The agent believes it is finished (what a plain turn loop stops on). */
  agentDone: boolean;
}

export interface Task {
  id: string;
  title: string;
  blurb: string;
  recommended: LoopType;
  goal: string;
  criteria: string[];
  maxTurns: number;
  budget: number;
  /** Time loops: simulated seconds between iterations. */
  intervalSec: number;
  steps: ScriptedStep[];
}

export type CheckStatus = "pass" | "fail" | "unchecked";

export interface CriterionResult {
  criterion: string;
  status: CheckStatus;
  note: string;
  by: "rule" | "claude" | "none";
}

export type StopReason =
  | "verified"
  | "agent-done"
  | "turn-limit"
  | "budget"
  | "script-exhausted"
  | "window-closed"
  | "cancelled"
  | "error";

export interface TurnRecord {
  turn: number;
  kind: "act" | "idle";
  /** Simulated clock (seconds since start). */
  clock: number;
  trigger?: string;
  observation?: string;
  act?: string;
  output?: string;
  agentDone?: boolean;
  tokens: number;
  results?: CriterionResult[];
  decision?: { action: "continue" | "stop"; reason: string; stop?: StopReason };
  phase: "act" | "evaluate" | "decide" | "done";
}

export interface LiveActRequest {
  phase: "act";
  loopType: LoopType;
  goal: string;
  criteria: string[];
  turn: number;
  observation?: string;
  trigger?: string;
  previousOutput?: string;
  feedback?: string;
}

export interface LiveJudgeRequest {
  phase: "judge";
  goal: string;
  criteria: string[];
  output: string;
}

export interface LiveActResponse {
  act: string;
  output: string;
  agentDone: boolean;
  tokens: number;
}

export interface LiveJudgeResponse {
  results: { criterion: string; pass: boolean; note: string }[];
  tokens: number;
}
