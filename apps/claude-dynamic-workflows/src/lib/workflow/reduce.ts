import type { JudgeItem, MarkerKind, ModelAlias, RunEvent } from "./types";

// Folds the SSE event stream into view state for the lanes, judge and baseline columns.

export interface LaneView {
  id: string;
  label: string;
  model: ModelAlias;
  phase: string | null;
  isolation: string | null;
  role: "worker" | "judge";
  context: string;
  prompt: string;
  text: string;
  tokens: number;
  retries: number;
  status: "running" | "done" | "null";
  ms?: number;
  result?: unknown;
  judge?: { rubric: string; items: JudgeItem[]; pick?: string };
}

export type BaselineItem =
  | { kind: "text"; text: string; drift: boolean }
  | { kind: "marker"; marker: MarkerKind; title: string; detail: string };

export interface RunView {
  status: "idle" | "running" | "done" | "error";
  error?: string;
  phases: { title: string; lanes: string[]; logs: string[] }[];
  lanes: Record<string, LaneView>;
  baseline: { items: BaselineItem[]; tokens: number; context: number; coverage: [number, number] | null; done: boolean; ms?: number };
  summary?: Extract<RunEvent, { type: "run_done" }>;
}

export const initialRun: RunView = {
  status: "idle",
  phases: [],
  lanes: {},
  baseline: { items: [], tokens: 0, context: 0, coverage: null, done: false },
};

function phaseFor(phases: RunView["phases"], title: string | null) {
  const t = title ?? "Run";
  let p = phases.find((x) => x.title === t);
  if (!p) {
    p = { title: t, lanes: [], logs: [] };
    phases.push(p);
  }
  return p;
}

export function reduce(state: RunView, e: RunEvent): RunView {
  switch (e.type) {
    case "run_start":
      return { ...initialRun, status: "running" };
    case "phase": {
      const phases = state.phases.map((p) => ({ ...p }));
      phaseFor(phases, e.title);
      return { ...state, phases };
    }
    case "log": {
      const phases = state.phases.map((p) => ({ ...p }));
      const p = phaseFor(phases, e.phase);
      p.logs = [...p.logs, e.message];
      return { ...state, phases };
    }
    case "agent_start": {
      const phases = state.phases.map((p) => ({ ...p }));
      const p = phaseFor(phases, e.phase);
      p.lanes = [...p.lanes, e.id];
      const lane: LaneView = { ...e, text: "", tokens: 0, retries: 0, status: "running" };
      return { ...state, phases, lanes: { ...state.lanes, [e.id]: lane } };
    }
    case "agent_delta":
    case "agent_retry":
    case "agent_done":
    case "judge": {
      const lane = state.lanes[e.id];
      if (!lane) return state;
      let next: LaneView = lane;
      if (e.type === "agent_delta") next = { ...lane, text: lane.text + e.text, tokens: e.tokens };
      if (e.type === "agent_retry") next = { ...lane, text: "", retries: e.attempt };
      if (e.type === "agent_done") next = { ...lane, status: e.result === null ? "null" : "done", tokens: e.tokens, ms: e.ms, result: e.result };
      if (e.type === "judge") next = { ...lane, judge: { rubric: e.rubric, items: e.items, pick: e.pick } };
      return { ...state, lanes: { ...state.lanes, [e.id]: next } };
    }
    case "baseline_delta": {
      const items = [...state.baseline.items];
      const last = items[items.length - 1];
      if (last?.kind === "text" && last.drift === e.drift) items[items.length - 1] = { ...last, text: last.text + e.text };
      else items.push({ kind: "text", text: e.text, drift: e.drift });
      return {
        ...state,
        baseline: { ...state.baseline, items, tokens: e.tokens, context: e.context, coverage: e.coverage ?? state.baseline.coverage },
      };
    }
    case "baseline_marker":
      return {
        ...state,
        baseline: {
          ...state.baseline,
          context: e.context || state.baseline.context,
          items: [...state.baseline.items, { kind: "marker", marker: e.kind, title: e.title, detail: e.detail }],
        },
      };
    case "baseline_done":
      return { ...state, baseline: { ...state.baseline, done: true, ms: e.ms } };
    case "run_done":
      return { ...state, status: "done", summary: e };
    case "error":
      return { ...state, status: "error", error: e.message };
  }
}

/** Parse a text/event-stream body into RunEvents. */
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<RunEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buf += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const data = block.split("\n").find((l) => l.startsWith("data: "));
      if (data) yield JSON.parse(data.slice(6)) as RunEvent;
    }
  }
}
