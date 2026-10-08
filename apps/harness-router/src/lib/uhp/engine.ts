import { harnessByBase, resolveModel, taskById, turnScript, type HarnessDef, type TaskDef, type TurnScript } from "../catalog";
import { containerId, encodeResponseId, fileId, previousSpec, sessionId, thisTurn, turnIndex, type RunSpec } from "./ids";
import { applyEvent } from "./reduce";
import type { ContainerFileCitation, OutputItem, StreamEventBody, UhpResponse, Usage } from "./types";

// Scripted UHP engine. (harness, task, turn) -> a timed, ordered event list that obeys the
// streaming rules: created first, item added before its deltas, done after them, exactly one
// terminal event. The final response is the same object whether you stream or not.

export interface TimedEvent {
  /** ms after the turn started */
  at: number;
  body: StreamEventBody;
}

export interface BuiltRun {
  id: string;
  spec: RunSpec;
  prompt: string;
  harness: HarnessDef;
  task: TaskDef;
  script: TurnScript;
  timeline: TimedEvent[];
  final: UhpResponse;
  duration: number;
}

export function resolveRun(spec: RunSpec): { harness: HarnessDef; task: TaskDef; script: TurnScript } | null {
  const harness = harnessByBase(spec.h);
  const task = taskById(spec.t);
  if (!harness || !task) return null;
  const script = turnScript(task, harness.base, turnIndex(spec));
  return script ? { harness, task, script } : null;
}

function chunks(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out.length ? out : [""];
}

const approxTokens = (s: string) => Math.ceil(s.length / 4);

/** Deterministic usage from what is in the output; null when the harness cannot account for it. */
export function usageFor(harness: HarnessDef, output: OutputItem[], prompt: string): Usage | null {
  if (!harness.style.reportsUsage) return null;
  let input = 850 + approxTokens(harness.systemPrompt) + approxTokens(prompt);
  let out = 0;
  for (const item of output) {
    if (item.type === "function_call_output") input += approxTokens(item.output);
    if (item.type === "function_call") out += approxTokens(item.arguments) + 12;
    if (item.type === "reasoning") out += item.summary.reduce((n, p) => n + approxTokens(p.text), 0) + 60;
    if (item.type === "message") out += item.content.reduce((n, p) => n + approxTokens(p.text), 0);
  }
  return { input_tokens: input, output_tokens: out, total_tokens: input + out };
}

export function baseUrl(origin: string) {
  return `${origin.replace(/\/$/, "")}/api/uhp`;
}

export function buildRun(spec: RunSpec, origin = ""): BuiltRun | null {
  const resolved = resolveRun(spec);
  if (!resolved) return null;
  const { harness, task, script } = resolved;
  const turn = thisTurn(spec);
  const n = turnIndex(spec);
  const id = encodeResponseId(spec);
  const prev = previousSpec(spec);
  const model = resolveModel(harness, turn.m || undefined);
  const prompt = n === 0 ? task.prompt : task.followUp.prompt;

  const metadata: UhpResponse["metadata"] = { session_id: sessionId(spec), harness_id: harness.id };
  if (model.ok && model.requested) {
    metadata.requested_model = model.requested;
    metadata.model_fallback = true;
    metadata.model_fallback_reason = model.fallbackReason;
  }
  if (turn.i.length) metadata.ignored_fields = turn.i;

  const shell: UhpResponse = {
    id,
    object: "response",
    created_at: Math.floor(turn.st / 1000),
    status: "in_progress",
    error: null,
    incomplete_details: null,
    previous_response_id: prev ? encodeResponseId(prev) : null,
    model: model.ok ? model.model : harness.defaultModel,
    output: [],
    store: true,
    usage: null,
    metadata,
  };

  const pace = harness.style.paceMs;
  const deltaPace = Math.max(35, Math.round(pace / 3));
  const toolPace = Math.round(pace * task.pace);
  const timeline: TimedEvent[] = [];
  let t = 0;
  const push = (body: StreamEventBody, wait = 0) => {
    t += wait;
    timeline.push({ at: t, body });
  };
  const output: OutputItem[] = [];

  push({ type: "response.created", response: structuredClone(shell) });
  push({ type: "response.in_progress", response: structuredClone(shell) });

  if (harness.style.reasoning && script.reasoning) {
    const idx = output.length;
    const itemId = `rs_${idx}`;
    push({ type: "response.output_item.added", output_index: idx, item: { id: itemId, type: "reasoning", summary: [], status: "in_progress" } }, pace);
    push({ type: "response.reasoning_summary_part.added", item_id: itemId, output_index: idx, summary_index: 0, part: { type: "summary_text", text: "" } });
    for (const delta of chunks(script.reasoning, harness.style.textChunk)) {
      push({ type: "response.reasoning_summary_text.delta", item_id: itemId, output_index: idx, summary_index: 0, delta }, deltaPace);
    }
    const part = { type: "summary_text" as const, text: script.reasoning };
    push({ type: "response.reasoning_summary_part.done", item_id: itemId, output_index: idx, summary_index: 0, part });
    const item: OutputItem = { id: itemId, type: "reasoning", summary: [part], status: "completed" };
    output.push(item);
    push({ type: "response.output_item.done", output_index: idx, item });
  }

  const budget = turn.x;
  let stepsRun = 0;
  let budgetHit = false;
  for (const [k, step] of script.steps.entries()) {
    if (budget !== null && stepsRun >= budget) {
      budgetHit = true;
      break;
    }
    const callId = `call_${n}_${k}`;
    const args = JSON.stringify(step.arguments);
    const fcIdx = output.length;
    const fcId = `fc_${k}`;
    push({ type: "response.output_item.added", output_index: fcIdx, item: { id: fcId, type: "function_call", call_id: callId, name: step.name, arguments: "", status: "in_progress" } }, pace);
    for (const delta of chunks(args, 40)) {
      push({ type: "response.function_call_arguments.delta", item_id: fcId, output_index: fcIdx, delta }, deltaPace);
    }
    push({ type: "response.function_call_arguments.done", item_id: fcId, output_index: fcIdx, arguments: args });
    const call: OutputItem = { id: fcId, type: "function_call", call_id: callId, name: step.name, arguments: args, status: "completed" };
    output.push(call);
    push({ type: "response.output_item.done", output_index: fcIdx, item: call });

    const foIdx = output.length;
    const foId = `fco_${k}`;
    push({ type: "response.output_item.added", output_index: foIdx, item: { id: foId, type: "function_call_output", call_id: callId, output: "", status: "in_progress" } }, 30);
    const result: OutputItem = { id: foId, type: "function_call_output", call_id: callId, output: step.output, status: "completed" };
    output.push(result);
    push({ type: "response.output_item.done", output_index: foIdx, item: result }, toolPace);
    stepsRun++;
  }

  if (!budgetHit) {
    const idx = output.length;
    const itemId = `msg_${n}`;
    const text = script.text;
    push({ type: "response.output_item.added", output_index: idx, item: { id: itemId, type: "message", role: "assistant", status: "in_progress", content: [] } }, pace);
    push({ type: "response.content_part.added", item_id: itemId, output_index: idx, content_index: 0, part: { type: "output_text", text: "", annotations: [] } });
    for (const delta of chunks(text, harness.style.textChunk)) {
      push({ type: "response.output_text.delta", item_id: itemId, output_index: idx, content_index: 0, delta }, deltaPace);
    }
    push({ type: "response.output_text.done", item_id: itemId, output_index: idx, content_index: 0, text });
    const annotations: ContainerFileCitation[] = script.artifacts.map((a, k) => {
      const fid = fileId(spec, n, k);
      const cid = containerId(spec.s);
      const start = Math.max(0, text.indexOf(a.filename));
      return {
        type: "container_file_citation",
        container_id: cid,
        file_id: fid,
        filename: a.filename,
        download_url: `${baseUrl(origin)}/v1/containers/${cid}/files/${fid}/content`,
        start_index: start,
        end_index: text.includes(a.filename) ? start + a.filename.length : 0,
      };
    });
    annotations.forEach((annotation, k) =>
      push({ type: "response.output_text.annotation.added", item_id: itemId, output_index: idx, content_index: 0, annotation_index: k, annotation }, 20),
    );
    const part = { type: "output_text" as const, text, annotations };
    push({ type: "response.content_part.done", item_id: itemId, output_index: idx, content_index: 0, part });
    const msg: OutputItem = { id: itemId, type: "message", role: "assistant", status: "completed", content: [part] };
    output.push(msg);
    push({ type: "response.output_item.done", output_index: idx, item: msg });
  }

  const final: UhpResponse = {
    ...structuredClone(shell),
    status: budgetHit ? "incomplete" : "completed",
    incomplete_details: budgetHit ? { reason: "max_step" } : null,
    output: structuredClone(output),
    usage: usageFor(harness, output, prompt),
  };
  push({ type: budgetHit ? "response.incomplete" : "response.completed", response: final }, 40);

  return { id, spec, prompt, harness, task, script, timeline, final, duration: t };
}

/** Events with `at <= elapsed`, minus the terminal one: what a client has seen so far. */
export function prefixAt(run: BuiltRun, elapsed: number): TimedEvent[] {
  return run.timeline.filter((e, i) => e.at <= elapsed && i < run.timeline.length - 1);
}

/** Rebuild the response as it stood `elapsed` ms after the turn started (no cancel). */
export function responseAt(run: BuiltRun, elapsed: number): UhpResponse {
  if (elapsed >= run.duration) return structuredClone(run.final);
  let resp: UhpResponse | null = null;
  for (const e of prefixAt(run, elapsed)) resp = applyEvent(resp, e.body);
  return resp!;
}

/**
 * The events that close a run cancelled `cancelAt` ms in: unfinished items are closed as
 * `incomplete` (partial output kept), then `response.failed` with `status: "cancelled"`.
 */
export function cancelTail(run: BuiltRun, cancelAt: number): StreamEventBody[] {
  if (cancelAt >= run.duration) return [];
  const partial = responseAt(run, cancelAt);
  const tail: StreamEventBody[] = [];
  const output = partial.output.map((item, idx) => {
    if (item.status !== "in_progress") return item;
    const closed = { ...structuredClone(item), status: "incomplete" as const };
    tail.push({ type: "response.output_item.done", output_index: idx, item: closed });
    return closed;
  });
  const response: UhpResponse = {
    ...partial,
    status: "cancelled",
    error: null,
    incomplete_details: null,
    output,
    usage: usageFor(run.harness, output, run.prompt),
  };
  tail.push({ type: "response.failed", response });
  return tail;
}

export function cancelledResponse(run: BuiltRun, cancelAt: number): UhpResponse {
  const tail = cancelTail(run, cancelAt);
  const last = tail[tail.length - 1];
  return last && last.type === "response.failed" ? structuredClone(last.response) : structuredClone(run.final);
}
