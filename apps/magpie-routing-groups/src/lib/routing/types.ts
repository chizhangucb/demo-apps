// Types for the simulated magpie gateway. Nothing here talks to a real provider.

export type Mode = "smart" | "order" | "rotate" | "usage" | "pace";
export const MODES: Mode[] = ["smart", "order", "rotate", "usage", "pace"];

export const MODE_LABEL: Record<Mode, string> = {
  smart: "Smart",
  order: "In order",
  rotate: "In turn",
  usage: "Least used first",
  pace: "Weekly pace",
};

export type Stays = "auto" | "session" | "turn" | "off" | "strict";
export const STAYS: Stays[] = ["auto", "session", "turn", "off", "strict"];

export type AgentId = "claude" | "codex" | "gemini";
export type Kind = "quick" | "refactor" | "test" | "long";
export type Tier = "strong" | "cheap";

/** A quota window. Hours are sim hours from the start of the day (08:00 = 0). */
export interface WindowSpec {
  kind: "5h" | "week";
  /** Capacity in quota tokens (illustrative). */
  cap: number;
  /** Share used at the start of the day, 0 to 100. */
  startPct: number;
  /** Next reset, in sim hours. */
  resetAt: number;
}

export interface Account {
  id: string;
  label: string;
  /** Plan name, e.g. "Claude Max". */
  plan: string;
  provider: string;
  /** The `provider/model` this account serves inside the group. */
  model: string;
  tier: Tier;
  /** Empty for pay-per-token API keys. */
  windows: WindowSpec[];
  /** List price per million tokens (illustrative). */
  price: { input: number; output: number };
  color: string;
}

export interface Member {
  accountId: string;
  enabled: boolean;
  paused?: boolean;
  /** Listed as a provider fallback model: goes after the other members (pick step 4). */
  fallback?: boolean;
}

export interface Turn {
  idx: number;
  /** Sim minutes from 08:00. */
  t: number;
  agent: AgentId;
  conv: string;
  kind: Kind;
  prompt: string;
  /** Context tokens sent with this turn. */
  context: number;
  output: number;
}

export interface Outage {
  accountId: string;
  from: number;
  to: number;
  code: 429 | 503;
}

export interface Config {
  mode: Mode;
  stays: Stays;
  sink: boolean;
  intent: boolean;
  members: Member[];
  /** Which `provider/model` each agent uses. `group/daily-coding` routes over the members. */
  picks: Record<AgentId, string>;
}

export interface WindowState {
  kind: "5h" | "week";
  cap: number;
  used: number;
  resetAt: number;
}

export interface AccountState {
  id: string;
  windows: WindowState[];
  restingUntil: number;
  rateLimitedUntil: number;
  tokens: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  turns: number;
  failures: number;
  /** Share of a window left unused when it renewed, summed (percentage points). */
  lost: { "5h": number; week: number };
  /** Recent sends, for usage ties and rotate's 30 minute look back. */
  recent: { t: number; conv: string; tokens: number }[];
}

export interface StepSnapshot {
  step: number;
  label: string;
  order: string[];
  note?: string;
}

export type Outcome = "ok" | "429" | "503" | "exhausted";

export interface Attempt {
  accountId: string;
  outcome: Outcome;
  note: string;
}

export interface TurnResult {
  turn: Turn;
  model: string;
  routed: boolean;
  intent?: { tag: Kind; tier: Tier; classifierCost: number };
  steps: StepSnapshot[];
  attempts: Attempt[];
  servedBy: string | null;
  why: string;
  sticky: boolean;
  cache: "hit" | "miss";
  cost: number;
  /** True only when the error reached the agent (stays=strict or nothing left). */
  agentError: boolean;
  /** Share used per account after this turn: id -> [5h, week] (null when no window). */
  usage: Record<string, [number | null, number | null]>;
}

export interface ResetEvent {
  t: number;
  accountId: string;
  kind: "5h" | "week";
  lostPct: number;
}

export interface SimResult {
  config: Config;
  turns: TurnResult[];
  accounts: AccountState[];
  resets: ResetEvent[];
  totals: {
    cost: number;
    classifierCost: number;
    failovers: number;
    agentErrors: number;
    cacheMisses: number;
    lost5h: number;
    lostWeek: number;
    tokens: number;
  };
}
