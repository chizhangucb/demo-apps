/** A Claude Code–shaped engine event. `name` is the event (e.g. `tool.call`); every other field is the payload `e`. */
export type ModEvent = { name: string } & Record<string, unknown>;

/** What Claude Code's own behavior would return at the end of the chain (simulated). */
export type EngineSpec =
  | { kind: "tool.call"; output: string }
  | { kind: "tool.check"; decision: "allow" | "ask" | "deny" }
  | { kind: "prompt.submit" }
  | { kind: "ui.render" };

export type Outcome = "deny" | "rewrite" | "pass-through" | "answer" | "error";

/** How the simulated user answers `$.ui.ask` (there's no real dialog in the playground). */
export type AskPolicy = "first" | "last" | "dismiss";

export type StarterMod = {
  id: string;
  name: string;
  blurb: string;
  /** What this starter shows off. */
  shows: Exclude<Outcome, "error" | "answer">[];
  source: string;
};

export type SampleEvent = {
  id: string;
  label: string;
  group: "Tools" | "Permissions" | "Prompts" | "Interface";
  event: ModEvent;
  engine: EngineSpec;
  /** Fixture: the outcome each starter mod should produce for this event. */
  expect: Record<string, Outcome>;
};

export type TraceStep = {
  kind: "fire" | "hook" | "skip" | "api" | "next" | "engine" | "return" | "error";
  label: string;
  detail?: string;
};

export type HookInfo = { event: string; matcher?: string; hasCatch: boolean };

export type FireResult = {
  outcome: Outcome;
  /** One-line, human reason for the outcome. */
  reason: string;
  original: ModEvent;
  /** The event as Claude Code's own behavior received it (after rewrites), if the chain reached it. */
  delivered?: ModEvent;
  engineResult?: unknown;
  result?: unknown;
  matchedHooks: number;
  trace: TraceStep[];
  ms: number;
};

export type LoadResult = { ok: true; hooks: HookInfo[] } | { ok: false; error: string };

export type SuggestRequest = { intent: string; event: ModEvent; current?: string };
export type SuggestResponse = { name: string; explanation: string; code: string; model: string };
