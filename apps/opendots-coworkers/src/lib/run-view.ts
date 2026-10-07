import { applyPatch, type AguiEvent, type Interrupt } from "./agui";
import type { Computer, DotId, RunState } from "./types";

export type Lane = DotId | "run";

export type TimelineItem =
  | { key: string; lane: Lane; kind: "subagent"; label: string; done: boolean }
  | { key: string; lane: Lane; kind: "step"; label: string }
  | { key: string; lane: Lane; kind: "text"; messageId: string }
  | { key: string; lane: Lane; kind: "tool"; toolCallId: string }
  | { key: string; lane: Lane; kind: "denied"; label: string }
  | { key: string; lane: Lane; kind: "note"; label: string; tone: "info" | "error" | "ok" };

export type ToolView = { name: string; args: string; result?: string; denied?: string };

export type Denial = { dot: DotId; dotName: string; tool: string; reason: string; toolCallId: string };

/** Everything the UI shows, folded from AG-UI events. Kept pure so it is easy to test. */
export type RunView = {
  status: "idle" | "running" | "review" | "done" | "error";
  events: AguiEvent[];
  state: RunState;
  computers: Record<DotId, Computer>;
  laneBySub: Record<string, DotId>;
  items: TimelineItem[];
  texts: Record<string, string>;
  tools: Record<string, ToolView>;
  denials: Denial[];
  interrupt: Interrupt | null;
};

export function emptyView(): RunView {
  return {
    status: "idle",
    events: [],
    state: { task: null, findings: [], draft: null, savedPage: null },
    computers: {
      researcher: { dot: "researcher", browser: null, files: [], terminal: [], activity: [] },
      writer: { dot: "writer", browser: null, files: [], terminal: [], activity: [] },
    },
    laneBySub: {},
    items: [],
    texts: {},
    tools: {},
    denials: [],
    interrupt: null,
  };
}

export function reduce(v: RunView, ev: AguiEvent): RunView {
  const next: RunView = { ...v, events: [...v.events, ev] };
  const lane: Lane = (ev.subagentRunId && v.laneBySub[ev.subagentRunId]) || "run";
  const key = `${v.events.length}`;
  const push = (item: TimelineItem) => (next.items = [...v.items, item]);

  switch (ev.type) {
    case "RUN_STARTED":
      next.status = "running";
      next.interrupt = null;
      break;
    case "RUN_FINISHED":
      if (ev.outcome?.type === "interrupt") {
        next.status = "review";
        next.interrupt = ev.outcome.interrupts[0] ?? null;
        push({ key, lane: "run", kind: "note", tone: "info", label: "Paused for review: Approve & save or Decline" });
      } else {
        next.status = "done";
        next.interrupt = null;
        push({ key, lane: "run", kind: "note", tone: "ok", label: "Run finished" });
      }
      break;
    case "RUN_ERROR":
      next.status = "error";
      push({ key, lane: "run", kind: "note", tone: "error", label: `Run error: ${ev.message}` });
      break;
    case "SUBAGENT_STARTED": {
      const dot = ev.name.toLowerCase() as DotId;
      next.laneBySub = { ...v.laneBySub, [ev.subagentRunId]: dot };
      push({ key, lane: dot, kind: "subagent", label: `${ev.name} started`, done: false });
      break;
    }
    case "SUBAGENT_FINISHED":
      push({ key, lane, kind: "subagent", label: "finished", done: true });
      break;
    case "SUBAGENT_ERROR":
      push({ key, lane, kind: "note", tone: "error", label: ev.message });
      break;
    case "STEP_STARTED":
      push({ key, lane, kind: "step", label: ev.stepName });
      break;
    case "TEXT_MESSAGE_START":
      next.texts = { ...v.texts, [ev.messageId]: "" };
      push({ key, lane, kind: "text", messageId: ev.messageId });
      break;
    case "TEXT_MESSAGE_CONTENT":
      next.texts = { ...v.texts, [ev.messageId]: (v.texts[ev.messageId] ?? "") + ev.delta };
      break;
    case "TOOL_CALL_START":
      next.tools = { ...v.tools, [ev.toolCallId]: { name: ev.toolCallName, args: "" } };
      push({ key, lane, kind: "tool", toolCallId: ev.toolCallId });
      break;
    case "TOOL_CALL_ARGS": {
      const t = v.tools[ev.toolCallId];
      if (t) next.tools = { ...v.tools, [ev.toolCallId]: { ...t, args: t.args + ev.delta } };
      break;
    }
    case "TOOL_CALL_RESULT": {
      const t = v.tools[ev.toolCallId];
      if (t) next.tools = { ...v.tools, [ev.toolCallId]: { ...t, result: ev.content } };
      break;
    }
    case "STATE_SNAPSHOT":
      next.state = ev.snapshot as RunState;
      break;
    case "STATE_DELTA":
      next.state = applyPatch(v.state, ev.delta);
      break;
    case "ACTIVITY_SNAPSHOT":
    case "ACTIVITY_DELTA": {
      const dot = ev.messageId.replace("computer-", "") as DotId;
      const computer =
        ev.type === "ACTIVITY_SNAPSHOT" ? (ev.content as Computer) : applyPatch(v.computers[dot], ev.patch);
      next.computers = { ...v.computers, [dot]: computer };
      break;
    }
    case "CUSTOM":
      if (ev.name === "permission_denied") {
        const d = ev.value as Denial;
        next.denials = [...v.denials, d];
        const t = v.tools[d.toolCallId];
        if (t) next.tools = { ...v.tools, [d.toolCallId]: { ...t, denied: d.reason } };
        push({ key, lane, kind: "denied", label: `${d.tool}, requested by ${d.dotName}, denied: ${d.reason}` });
      } else if (ev.name === "handoff") {
        const h = ev.value as { text: string };
        push({ key, lane: "run", kind: "note", tone: "info", label: h.text });
      } else if (ev.name === "live_error") {
        push({ key, lane: "run", kind: "note", tone: "error", label: "Live mode failed; used the scripted draft." });
      }
      break;
  }
  return next;
}

/** Consecutive timeline items in the same lane, so the UI can group the stream by Dot. */
export function groupByLane(items: TimelineItem[]): { lane: Lane; items: TimelineItem[] }[] {
  const groups: { lane: Lane; items: TimelineItem[] }[] = [];
  for (const it of items) {
    const last = groups[groups.length - 1];
    if (last && last.lane === it.lane) last.items.push(it);
    else groups.push({ lane: it.lane, items: [it] });
  }
  return groups;
}
