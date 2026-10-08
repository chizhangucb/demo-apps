import type { HttpError } from "./uhp/client";
import { applyEvent } from "./uhp/reduce";
import { TERMINAL_EVENTS, type SessionFile, type StreamEvent, type UhpResponse } from "./uhp/types";

// Client-side run state: one column per harness session, each holding its turns.

export interface Turn {
  key: string;
  prompt: string;
  request: Record<string, unknown>;
  events: StreamEvent[];
  response: UhpResponse | null;
  error?: HttpError;
  startedAt: number;
  endedAt?: number;
  /** set when the client gave up waiting for the stream after a cancel and used the cancel reply */
  cancelNote?: string;
  cancelRequested?: boolean;
}

export interface Column {
  key: string;
  harnessId: string;
  turns: Turn[];
  files: SessionFile[];
}

export function newTurn(key: string, prompt: string, request: Record<string, unknown>): Turn {
  return { key, prompt, request, events: [], response: null, startedAt: Date.now() };
}

export type Action =
  | { type: "reset"; columns: Column[] }
  | { type: "addColumns"; columns: Column[] }
  | { type: "addTurn"; column: string; turn: Turn }
  | { type: "event"; column: string; turn: string; event: StreamEvent }
  | { type: "error"; column: string; turn: string; error: HttpError }
  | { type: "streamClosed"; column: string; turn: string }
  | { type: "cancelRequested"; column: string; turn: string }
  | { type: "cancelFallback"; column: string; turn: string; response: UhpResponse }
  | { type: "stored"; column: string; turn: string; response: UhpResponse }
  | { type: "files"; column: string; files: SessionFile[] };

export const isTerminalEvent = (e: StreamEvent) => (TERMINAL_EVENTS as readonly string[]).includes(e.type);

export function turnRunning(t: Turn): boolean {
  return !t.error && !t.endedAt;
}

export function columnRunning(c: Column): boolean {
  const last = c.turns.at(-1);
  return !!last && turnRunning(last);
}

function mapTurn(cols: Column[], column: string, turn: string, fn: (t: Turn) => Turn): Column[] {
  return cols.map((c) => (c.key !== column ? c : { ...c, turns: c.turns.map((t) => (t.key === turn ? fn(t) : t)) }));
}

export function reducer(cols: Column[], a: Action): Column[] {
  switch (a.type) {
    case "reset":
      return a.columns;
    case "addColumns":
      return [...cols, ...a.columns];
    case "addTurn":
      return cols.map((c) => (c.key === a.column ? { ...c, turns: [...c.turns, a.turn] } : c));
    case "event":
      return mapTurn(cols, a.column, a.turn, (t) => ({
        ...t,
        events: [...t.events, a.event],
        response: applyEvent(t.response, a.event),
        endedAt: isTerminalEvent(a.event) ? Date.now() : t.endedAt,
      }));
    case "error":
      return mapTurn(cols, a.column, a.turn, (t) => ({ ...t, error: a.error, endedAt: Date.now() }));
    case "streamClosed":
      return mapTurn(cols, a.column, a.turn, (t) => (t.endedAt ? t : { ...t, endedAt: Date.now(), cancelNote: t.cancelNote ?? "Stream closed before a terminal event." }));
    case "cancelRequested":
      return mapTurn(cols, a.column, a.turn, (t) => ({ ...t, cancelRequested: true }));
    case "cancelFallback":
      return mapTurn(cols, a.column, a.turn, (t) =>
        t.endedAt
          ? t
          : {
              ...t,
              response: a.response,
              endedAt: Date.now(),
              cancelNote: "No terminal event within 1s, so the client closed the stream and rendered the response returned by the cancel call (the stored response is the source of truth).",
            },
      );
    case "stored":
      return mapTurn(cols, a.column, a.turn, (t) => ({
        ...t,
        response: a.response,
        endedAt: a.response.status === "in_progress" ? t.endedAt : (t.endedAt ?? Date.now()),
      }));
    case "files":
      return cols.map((c) => (c.key === a.column ? { ...c, files: a.files } : c));
  }
}

export interface TurnSummary {
  status: string;
  model: string;
  fallback: boolean;
  reasoning: boolean;
  steps: number;
  tools: string[];
  artifacts: number;
  usage: string;
  elapsed: string;
  events: number;
}

export function summarise(t: Turn): TurnSummary | null {
  const r = t.response;
  if (!r) return null;
  const tools = r.output.flatMap((o) => (o.type === "function_call" ? [o.name] : []));
  return {
    status: r.status,
    model: r.model,
    fallback: !!r.metadata.model_fallback,
    reasoning: r.output.some((o) => o.type === "reasoning"),
    steps: tools.length,
    tools: [...new Set(tools)],
    artifacts: r.output.reduce((n, o) => n + (o.type === "message" ? o.content.reduce((k, c) => k + c.annotations.length, 0) : 0), 0),
    usage: r.usage ? `${r.usage.total_tokens.toLocaleString()} tok` : r.status === "in_progress" ? "…" : "null",
    elapsed: `${(((t.endedAt ?? Date.now()) - t.startedAt) / 1000).toFixed(1)}s`,
    events: t.events.length,
  };
}
