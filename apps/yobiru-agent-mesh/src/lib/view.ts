import type { AuthStep, Envelope, FetchItem, RequestState, WakeDecision } from "./mesh/types";
import { HOSTS, type Host } from "./setup";
import type { StoryEvent, Tone } from "./story";

export interface LogLine {
  cli: boolean;
  text: string;
  tone: Tone;
}

export interface PacketView {
  index: number;
  from: Host;
  to: Host;
  label: string;
  status: number;
  error?: string;
  reply: boolean;
  envelope: Envelope;
  steps: AuthStep[];
  wake?: WakeDecision;
}

export interface FileView {
  owner: Host;
  fetcher: Host;
  item: FetchItem;
  tampered: boolean;
  fetched: boolean;
  ok?: boolean;
  computed?: string;
  steps: string[];
  error?: string;
}

export interface RequestView {
  owner: Host;
  id: string;
  label: string;
  state: RequestState;
  deadline: number;
  history: { state: RequestState; at: number; note: string }[];
}

export interface MachineView {
  logs: LogLine[];
  agent: "awake" | "asleep";
  inbox: { id: string; kind: string; from: string; wake: string }[];
  lastWake?: WakeDecision;
}

export interface View {
  now: number;
  phase: string | null;
  machines: Record<Host, MachineView>;
  packets: PacketView[];
  files: FileView[];
  requests: RequestView[];
  done: Extract<StoryEvent, { type: "done" }> | null;
}

export function reduceView(events: StoryEvent[], upto: number, start: number): View {
  const machines = Object.fromEntries(HOSTS.map((h) => [h, { logs: [], agent: "asleep", inbox: [] } as MachineView])) as Record<Host, MachineView>;
  const view: View = { now: start, phase: null, machines, packets: [], files: [], requests: [], done: null };
  for (let i = 0; i < Math.min(upto, events.length); i++) {
    const e = events[i];
    view.now = e.t;
    switch (e.type) {
      case "phase":
        view.phase = e.title;
        break;
      case "cli":
        machines[e.host].logs.push({ cli: true, text: `$ ${e.cmd}`, tone: "info" });
        break;
      case "log":
        machines[e.host].logs.push({ cli: false, text: e.line, tone: e.tone });
        break;
      case "packet":
        view.packets.push({ index: i, from: e.from, to: e.to, label: e.label, status: e.status, error: e.error, reply: e.reply, envelope: e.envelope, steps: e.steps });
        break;
      case "wake": {
        machines[e.host].lastWake = e.decision;
        const last = view.packets[view.packets.length - 1];
        if (last && last.to === e.host) last.wake = e.decision;
        break;
      }
      case "agent":
        machines[e.host].agent = e.state;
        break;
      case "inbox":
        machines[e.host].inbox.push({ id: e.id, kind: e.kind, from: e.from, wake: e.wake });
        break;
      case "file": {
        let f = view.files.find((x) => x.item.name === e.item.name);
        if (!f) {
          f = { owner: e.owner, fetcher: e.fetcher, item: e.item, tampered: false, fetched: false, steps: [] };
          view.files.push(f);
        }
        if (e.stage === "tamper") f.tampered = true;
        if (e.stage === "fetch") Object.assign(f, { fetched: true, ok: e.ok, computed: e.computed, steps: e.steps ?? [], error: e.error });
        break;
      }
      case "request": {
        let r = view.requests.find((x) => x.id === e.id);
        if (!r) {
          r = { owner: e.owner, id: e.id, label: e.label, state: e.state, deadline: e.deadline, history: [] };
          view.requests.push(r);
        }
        r.state = e.state;
        r.history.push({ state: e.state, at: e.t, note: e.note });
        break;
      }
      case "done":
        view.done = e;
        break;
    }
  }
  return view;
}

/** Playback delay for an event, in ms at 1x. */
export function delayFor(e: StoryEvent | undefined): number {
  if (!e) return 0;
  if (e.type === "packet") return 1500;
  if (e.type === "phase") return 900;
  if (e.type === "file" && e.stage === "fetch") return 1200;
  if (e.type === "cli") return 450;
  return 300;
}
