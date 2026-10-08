import harnessData from "../../data/harnesses.json";
import fixTask from "../../data/tasks/fix-failing-test.json";
import researchTask from "../../data/tasks/research-brief.json";
import summariseTask from "../../data/tasks/summarise-readme.json";
import type { Harness, HarnessModel } from "./uhp/types";

// Per-harness behaviour lives in data/, not code: adding a harness or a task is a JSON edit.

export interface HarnessStyle {
  tools: string[];
  reasoning: boolean;
  reportsUsage: boolean;
  paceMs: number;
  textChunk: number;
  accent: string;
  blurb: string;
}

export interface HarnessDef extends Omit<Harness, "object"> {
  models: { id: string; available: boolean }[];
  onUnavailableModel: "substitute" | "reject";
  style: HarnessStyle;
}

export interface ScriptStep {
  name: string;
  arguments: Record<string, unknown>;
  output: string;
}

export interface Artifact {
  filename: string;
  mimeType: string;
  content: string;
}

export interface TurnScript {
  reasoning?: string;
  steps: ScriptStep[];
  text: string;
  artifacts: Artifact[];
}

export interface TaskDef {
  id: string;
  order: number;
  title: string;
  blurb: string;
  prompt: string;
  pace: number;
  inputFile?: { filename: string; mimeType: string; content: string };
  scripts: Record<string, TurnScript>;
  followUp: { prompt: string; scripts: Record<string, TurnScript> };
}

export const HARNESSES: HarnessDef[] = harnessData.harnesses as HarnessDef[];
export const TASKS: TaskDef[] = ([summariseTask, fixTask, researchTask] as TaskDef[]).sort((a, b) => a.order - b.order);

export function harnessById(id: string | undefined): HarnessDef | undefined {
  return HARNESSES.find((h) => h.id === id);
}

export function harnessByBase(base: string): HarnessDef | undefined {
  return HARNESSES.find((h) => h.base === base);
}

export function taskById(id: string | undefined): TaskDef | undefined {
  return TASKS.find((t) => t.id === id);
}

/** Turn 0 runs the task script; every later turn in the session runs the follow-up script. */
export function turnScript(task: TaskDef, base: string, turn: number): TurnScript | undefined {
  return turn === 0 ? task.scripts[base] : task.followUp.scripts[base];
}

export function publicHarness(h: HarnessDef): Harness {
  return {
    id: h.id,
    object: "harness",
    name: h.name,
    base: h.base,
    baseLabel: h.baseLabel,
    defaultModel: h.defaultModel,
    systemPrompt: h.systemPrompt,
    mcpServers: h.mcpServers,
    skills: h.skills,
    disabledTools: h.disabledTools,
    maxStep: h.maxStep,
    timeoutSeconds: h.timeoutSeconds,
    createdAt: h.createdAt,
  };
}

export function harnessModels(h: HarnessDef): HarnessModel[] {
  return h.models.map((m) => ({ id: m.id, object: "model", available: m.available, default: m.id === h.defaultModel }));
}

export type ModelResolution =
  | { ok: true; model: string; requested?: string; fallbackReason?: string }
  | { ok: false; message: string };

/** Which model actually runs. Substitution is always reported, never silent. */
export function resolveModel(h: HarnessDef, requested: string | undefined): ModelResolution {
  if (!requested) return { ok: true, model: h.defaultModel };
  const known = h.models.find((m) => m.id === requested);
  if (known?.available) return { ok: true, model: requested };
  const why = known
    ? `${requested} is listed for ${h.name} but not available right now`
    : `${requested} is not served by the ${h.base} harness`;
  if (h.onUnavailableModel === "reject") return { ok: false, message: `${why}.` };
  return { ok: true, model: h.defaultModel, requested, fallbackReason: `${why}; ran the harness default ${h.defaultModel}.` };
}
