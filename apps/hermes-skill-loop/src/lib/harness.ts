import type { RunStats, RunStep, Skill } from "@/lib/types";

/** Scoreboard numbers for a run. */
export function statsOf(steps: RunStep[]): RunStats {
  return {
    steps: steps.length,
    toolCalls: steps.filter((s) => s.kind === "tool").length,
    wasted: steps.filter((s) => s.wasted).length,
    tokens: steps.reduce((n, s) => n + s.tokens, 0),
  };
}

/** Render a skill the way Hermes stores it on disk: ~/.hermes/skills/<name>/SKILL.md. */
export function skillToMarkdown(skill: Skill): string {
  return [
    "---",
    `name: ${skill.name}`,
    `description: ${skill.description}`,
    `tools: [${skill.tools.join(", ")}]`,
    "---",
    "",
    `## When to use`,
    skill.trigger,
    "",
    "## Procedure",
    ...skill.steps.map((s, i) => `${i + 1}. ${s}`),
    "",
    "## Pitfalls",
    ...skill.pitfalls.map((p) => `- ${p}`),
  ].join("\n");
}

/**
 * Scripted skill extraction: the same distillation Hermes does after a complex task, replayed as
 * visible sub-steps. Each line cites what in the source run it came from.
 */
export function extractionTrace(steps: RunStep[], skill: Skill): string[] {
  const s = statsOf(steps);
  return [
    `Reviewing run: ${s.steps} events, ${s.toolCalls} tool calls, ${s.wasted} dead end${s.wasted === 1 ? "" : "s"}`,
    `Run qualifies as a skill: ≥5 tool calls and recovered from errors`,
    `Distilling ${skill.steps.length} procedure steps from the successful path`,
    `Recording ${skill.pitfalls.length} pitfall${skill.pitfalls.length === 1 ? "" : "s"} learned from the dead ends`,
    `Writing ~/.hermes/skills/${skill.name}/SKILL.md`,
  ];
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
