// Local AG-UI types, an SSE encoder for the route and an SSE reader for the client.
// Wire names follow the AG-UI spec (SCREAMING_SNAKE_CASE `type`); no runtime dependency on @ag-ui/*.

export type JsonPatchOp =
  | { op: "add" | "replace"; path: string; value: unknown }
  | { op: "remove"; path: string };

type Base = { timestamp?: number; subagentRunId?: string };

export type AguiEvent = Base &
  (
    | { type: "RUN_STARTED"; threadId: string; runId: string }
    | { type: "RUN_FINISHED"; threadId: string; runId: string; result?: unknown; outcome?: RunOutcome }
    | { type: "RUN_ERROR"; message: string; code?: string }
    | { type: "STEP_STARTED"; stepName: string }
    | { type: "STEP_FINISHED"; stepName: string }
    | { type: "TEXT_MESSAGE_START"; messageId: string; role: "assistant" }
    | { type: "TEXT_MESSAGE_CONTENT"; messageId: string; delta: string }
    | { type: "TEXT_MESSAGE_END"; messageId: string }
    | { type: "TOOL_CALL_START"; toolCallId: string; toolCallName: string; parentMessageId?: string }
    | { type: "TOOL_CALL_ARGS"; toolCallId: string; delta: string }
    | { type: "TOOL_CALL_END"; toolCallId: string }
    | { type: "TOOL_CALL_RESULT"; messageId: string; toolCallId: string; content: string; role?: "tool" }
    | { type: "STATE_SNAPSHOT"; snapshot: unknown }
    | { type: "STATE_DELTA"; delta: JsonPatchOp[] }
    | { type: "ACTIVITY_SNAPSHOT"; messageId: string; activityType: string; content: unknown }
    | { type: "ACTIVITY_DELTA"; messageId: string; activityType: string; patch: JsonPatchOp[] }
    | { type: "SUBAGENT_STARTED"; subagentRunId: string; name: string; description?: string }
    | { type: "SUBAGENT_FINISHED"; subagentRunId: string; result?: unknown }
    | { type: "SUBAGENT_ERROR"; subagentRunId: string; message: string; code?: string }
    | { type: "CUSTOM"; name: string; value: unknown }
  );

export type AguiEventType = AguiEvent["type"];

export type Interrupt = { id: string; reason: string; payload?: unknown };

export type RunOutcome = { type: "success" } | { type: "interrupt"; interrupts: Interrupt[] };

export type ResumeEntry = { interruptId: string; status: "approved" | "declined"; payload?: unknown };

/** RunAgentInput, plus the optional `resume` array used to answer an interrupt. */
export type RunAgentInput = {
  threadId: string;
  runId: string;
  messages: { id: string; role: "user" | "assistant"; content: string }[];
  tools: unknown[];
  context: unknown[];
  state: unknown;
  forwardedProps: unknown;
  resume?: ResumeEntry[];
};

const encoder = new TextEncoder();

/** One AG-UI event as one SSE frame: `data: <json>\n\n`. */
export function encodeSse(event: AguiEvent): Uint8Array {
  const withTs = event.timestamp ? event : { ...event, timestamp: Date.now() };
  return encoder.encode(`data: ${JSON.stringify(withTs)}\n\n`);
}

/** Parse a text/event-stream body into AG-UI events. Tolerates frames split across chunks. */
export async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<AguiEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (value) buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const event = parseFrame(frame);
      if (event) yield event;
    }
    if (done) {
      const event = parseFrame(buf);
      if (event) yield event;
      return;
    }
  }
}

export function parseFrame(frame: string): AguiEvent | null {
  const data = frame
    .split("\n")
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trimStart())
    .join("\n");
  if (!data) return null;
  return JSON.parse(data) as AguiEvent;
}

/** Minimal RFC 6902 apply (add / replace / remove, `-` appends). Returns a new object. */
export function applyPatch<T>(doc: T, ops: JsonPatchOp[]): T {
  let out: unknown = structuredClone(doc);
  for (const op of ops) {
    const keys = op.path.split("/").slice(1).map((k) => k.replace(/~1/g, "/").replace(/~0/g, "~"));
    if (keys.length === 0) {
      if (op.op !== "remove") out = structuredClone(op.value);
      continue;
    }
    let parent = out as Record<string, unknown> | unknown[];
    for (const k of keys.slice(0, -1)) {
      const next = (parent as Record<string, unknown>)[k];
      if (next === undefined || next === null) (parent as Record<string, unknown>)[k] = {};
      parent = (parent as Record<string, unknown>)[k] as Record<string, unknown>;
    }
    const last = keys[keys.length - 1];
    if (Array.isArray(parent)) {
      const i = last === "-" ? parent.length : Number(last);
      if (op.op === "add") parent.splice(i, 0, structuredClone(op.value));
      else if (op.op === "replace") parent[i] = structuredClone(op.value);
      else parent.splice(i, 1);
    } else if (op.op === "remove") {
      delete (parent as Record<string, unknown>)[last];
    } else {
      (parent as Record<string, unknown>)[last] = structuredClone(op.value);
    }
  }
  return out as T;
}
