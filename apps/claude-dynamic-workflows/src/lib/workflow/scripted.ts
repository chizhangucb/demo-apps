import type { AgentCall, RuntimeHost } from "./runtime";
import type { JudgeView, LaneData, ModelAlias, RunEvent, TaskData } from "./types";

// Scripted mode: agent() resolves from task data, matched by label, and streams with pacing.
// The orchestration (fan-out, barrier, bracket loop, filters) is still run by the real script.

export type Emit = (event: RunEvent) => void;

export interface Pace {
  /** Milliseconds per streamed chunk at 1x. 0 runs instantly (tests). */
  chunkMs: number;
  signal?: AbortSignal;
}

const SESSION_MODEL: ModelAlias = "opus";

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0 || signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
  });
}

/** Deterministic jitter so parallel lanes visibly drift apart without Math.random. */
function jitter(seed: string, i: number): number {
  let h = 2166136261;
  for (const ch of `${seed}:${i}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

export function chunkText(text: string, words = 4): string[] {
  const parts = text.match(/\S+\s*/g) ?? [];
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += words) out.push(parts.slice(i, i + words).join(""));
  return out;
}

/** Find the scripted lane for a label: exact entry first, then a computed rule (bouts, rankings). */
export function resolveLane(task: TaskData, label: string, prompt: string): LaneData | null {
  const exact = task.lanes[label];
  if (exact) return exact;
  const t = task.tournament;
  for (const rule of task.rules ?? []) {
    const m = new RegExp(rule.match).exec(label);
    if (!m || !t) continue;
    const rank = (name: string) => {
      const i = t.ranking.indexOf(name);
      return i < 0 ? t.ranking.length : i;
    };
    if (rule.kind === "pairwise") {
      const [a, b] = [m[1], m[2]];
      const winner = rank(a) <= rank(b) ? a : b;
      const loser = winner === a ? b : a;
      const judge: JudgeView = {
        rubric: t.rubric,
        items: [a, b].map((n) => ({ subject: n, verdict: n === winner ? "wins" : "out", ok: n === winner, note: t.reasons[n] })),
        pick: winner,
      };
      return {
        role: "judge",
        context: rule.context,
        tokens: rule.tokens,
        text: `"${a}": ${t.reasons[a] ?? "no notes"}\n"${b}": ${t.reasons[b] ?? "no notes"}\nSide by side, "${winner}" beats "${loser}" on the rubric. Winner: ${winner}.`,
        result: { winner, reason: t.reasons[winner] ?? "" },
        judge,
      };
    }
    const candidates = (/Candidates: (.+)$/m.exec(prompt)?.[1] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const ranking = [...candidates].sort((x, y) => rank(x) - rank(y));
    return {
      role: "judge",
      context: rule.context,
      tokens: rule.tokens,
      text: ranking.map((n, i) => `${i + 1}. ${n}: ${t.reasons[n] ?? ""}`).join("\n") + `\nFinal pick: ${ranking[0]}.`,
      result: { ranking },
      judge: {
        rubric: t.rubric,
        items: ranking.map((n, i) => ({ subject: n, verdict: `#${i + 1}`, ok: i === 0, note: t.reasons[n] })),
        pick: ranking[0],
      },
    };
  }
  return null;
}

async function stream(id: string, label: string, text: string, tokens: number, emit: Emit, pace: Pace) {
  const chunks = chunkText(text);
  const per = chunks.length ? tokens / chunks.length : 0;
  for (let i = 0; i < chunks.length; i++) {
    await sleep(pace.chunkMs * (0.6 + jitter(label, i)), pace.signal);
    emit({ type: "agent_delta", id, text: chunks[i], tokens: Math.round(per * (i + 1)) });
  }
}

export interface ScriptedStats {
  agents: number;
  tokens: number;
}

export function createScriptedHost(task: TaskData, emit: Emit, pace: Pace): { host: RuntimeHost; stats: ScriptedStats } {
  const stats: ScriptedStats = { agents: 0, tokens: 0 };
  const host: RuntimeHost = {
    phase: (title) => emit({ type: "phase", title }),
    log: (message, phase) => emit({ type: "log", message, phase }),
    async agent(call: AgentCall) {
      const id = `a${call.index}`;
      const label = call.options.label ?? `agent ${call.index + 1}`;
      const lane = resolveLane(task, label, call.prompt);
      const started = Date.now();
      // The model the script names wins; otherwise the lane's own default, then the session model.
      const model = (call.options.model as ModelAlias | undefined) ?? lane?.model ?? SESSION_MODEL;
      stats.agents++;
      emit({
        type: "agent_start",
        id,
        label,
        model,
        phase: call.phase,
        isolation: call.options.isolation ?? null,
        role: lane?.role ?? "worker",
        context: lane?.context ?? "Fresh window",
        prompt: call.prompt,
      });
      if (!lane) {
        emit({ type: "agent_delta", id, text: "No scripted output for this label.", tokens: 0 });
        emit({ type: "agent_done", id, result: null, tokens: 0, ms: Date.now() - started });
        return null;
      }
      if (lane.retry) {
        const head = chunkText(lane.text).slice(0, 3).join("");
        await stream(id, label, head, Math.round(lane.tokens * 0.2), emit, pace);
        await sleep(pace.chunkMs * 6, pace.signal);
        emit({ type: "agent_retry", id, attempt: 1 });
      }
      await stream(id, label, lane.text, lane.tokens, emit, pace);
      stats.tokens += lane.tokens + (lane.retry ? Math.round(lane.tokens * 0.2) : 0);
      if (lane.fail) {
        emit({ type: "agent_done", id, result: null, tokens: lane.tokens, ms: Date.now() - started });
        return null;
      }
      if (lane.judge) emit({ type: "judge", id, label, ...lane.judge });
      emit({ type: "agent_done", id, result: lane.result, tokens: lane.tokens, ms: Date.now() - started });
      return lane.result;
    },
  };
  return { host, stats };
}

/** The same task done by one agent in one context window, with its failure moments annotated. */
export async function streamBaseline(task: TaskData, emit: Emit, pace: Pace): Promise<{ tokens: number; ms: number }> {
  const started = Date.now();
  let tokens = 0;
  let context = 0;
  for (const step of task.baseline.steps) {
    if (step.marker) {
      await sleep(pace.chunkMs * 3, pace.signal);
      if (step.contextAfter !== undefined) context = step.contextAfter;
      emit({ type: "baseline_marker", ...step.marker, context });
    }
    const chunks = chunkText(step.text);
    const per = chunks.length ? step.tokens / chunks.length : 0;
    for (let i = 0; i < chunks.length; i++) {
      await sleep(pace.chunkMs * (0.6 + jitter("baseline", tokens + i)), pace.signal);
      tokens += per;
      context += per;
      emit({
        type: "baseline_delta",
        // Keep steps apart as paragraphs in the transcript.
        text: i === chunks.length - 1 ? chunks[i].trimEnd() + "\n\n" : chunks[i],
        tokens: Math.round(tokens),
        drift: !!step.drift,
        context: Math.round(context),
        coverage: i === chunks.length - 1 ? step.coverage : undefined,
      });
    }
  }
  return { tokens: Math.round(tokens), ms: Date.now() - started };
}
