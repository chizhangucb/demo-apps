import "server-only";
import { harnessByBase, harnessById, HARNESSES, resolveModel, taskById, TASKS, turnScript } from "@/lib/catalog";
import { buildRun, cancelledResponse, cancelTail, responseAt, type BuiltRun } from "@/lib/uhp/engine";
import {
  containerId,
  decodeFileId,
  decodeResponseId,
  decodeSessionId,
  nonce,
  SAFE_MODEL,
  sessionId,
  thisTurn,
  type RunSpec,
  type TurnCore,
} from "@/lib/uhp/ids";
import { UHP_VERSION, type ErrorEnvelope, type ErrorType, type ResponseRequest, type SessionFile, type UhpResponse } from "@/lib/uhp/types";

// ---- Module-level registry. Works locally and on a warm serverless instance; everything that
// must survive a cold start is rebuilt from the deterministic ids instead.

interface Registry {
  /** response id -> ms after start when cancel was requested */
  cancels: Map<string, number>;
  /** session id -> response id currently running on this instance */
  active: Map<string, string>;
  /** session id -> latest response id seen on this instance */
  latest: Map<string, string>;
}
const g = globalThis as unknown as { __uhpRegistry?: Registry };
export const registry: Registry = (g.__uhpRegistry ??= { cancels: new Map(), active: new Map(), latest: new Map() });

// ---- HTTP helpers

export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("UHP-Version", UHP_VERSION);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

export class UhpError extends Error {
  constructor(
    readonly status: number,
    readonly type: ErrorType,
    readonly code: string,
    message: string,
    readonly param: string | null = null,
    readonly detail: unknown = null,
  ) {
    super(message);
  }
  toResponse(): Response {
    const body: ErrorEnvelope = { error: { type: this.type, code: this.code, message: this.message, param: this.param, detail: this.detail } };
    return json(body, { status: this.status });
  }
}

/** Wrap a route handler so any thrown UhpError becomes the error envelope. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof UhpError) return err.toResponse();
      console.error(err);
      return new UhpError(500, "server_error", "server_error", "Unexpected error in the scripted UHP server.").toResponse();
    }
  };
}

export const notFound = (code: string, what: string, param: string | null = null) =>
  new UhpError(404, "invalid_request_error", code, `${what} not found.`, param);

// ---- Runs

const KNOWN_FIELDS = new Set([
  "input", "model", "metadata", "stream", "previous_response_id", "instructions", "store",
  "max_output_tokens", "max_step", "timeout_seconds", "background",
]);

function inputText(input: ResponseRequest["input"]): string {
  if (typeof input === "string") return input;
  for (const item of input) {
    if (typeof item.content === "string") return item.content;
    const part = item.content.find((p) => p.type === "input_text");
    if (part && part.type === "input_text") return part.text;
  }
  return "";
}

/** Validate a POST /v1/responses body and turn it into a deterministic run. */
export function createRun(body: unknown, origin: string): { run: BuiltRun; req: ResponseRequest } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new UhpError(400, "invalid_request_error", "invalid_request", "Body must be a JSON object.");
  }
  const req = body as ResponseRequest;
  if (typeof req.input !== "string" && !Array.isArray(req.input)) {
    throw new UhpError(400, "invalid_request_error", "invalid_request", "`input` is required (string or array of items).", "input");
  }

  // Ignoring must be observable: reserved and unknown fields come back in metadata.ignored_fields.
  const ignored = Object.keys(req)
    .filter((k) => !KNOWN_FIELDS.has(k))
    .map((k) => k.replace(/[^A-Za-z0-9_]/g, "").slice(0, 40))
    .filter(Boolean)
    .slice(0, 8);

  const metadata = (req.metadata ?? {}) as Record<string, unknown>;
  const harnessId = typeof metadata.harness_id === "string" ? metadata.harness_id : undefined;

  let prev: RunSpec | null = null;
  if (req.previous_response_id !== undefined) {
    prev = typeof req.previous_response_id === "string" ? decodeResponseId(req.previous_response_id) : null;
    if (!prev || !buildRun(prev)) throw notFound("response_not_found", "Previous response", "previous_response_id");
  }

  let harness = harnessId ? harnessById(harnessId) : undefined;
  if (harnessId && !harness) throw notFound("harness_not_found", `Harness ${harnessId}`, "metadata.harness_id");
  if (prev) {
    const prevHarness = harnessByBase(prev.h)!;
    if (harness && harness.id !== prevHarness.id) {
      throw new UhpError(
        409, "invalid_request_error", "harness_mismatch",
        `previous_response_id belongs to a ${prevHarness.name} session; it cannot continue on ${harness.name}.`,
        "metadata.harness_id",
        { session_harness_id: prevHarness.id, requested_harness_id: harness.id },
      );
    }
    harness = prevHarness;
  }
  harness ??= HARNESSES[0];

  if (req.model !== undefined && (typeof req.model !== "string" || !SAFE_MODEL.test(req.model))) {
    throw new UhpError(400, "invalid_request_error", "invalid_request", "`model` must be a model id string.", "model");
  }
  const model = resolveModel(harness, req.model);
  if (!model.ok) {
    throw new UhpError(422, "invalid_request_error", "model_unavailable", model.message, "model", {
      harness_id: harness.id,
      available_models: harness.models.filter((m) => m.available).map((m) => m.id),
    });
  }

  if (req.max_step !== undefined && (!Number.isInteger(req.max_step) || req.max_step < 0 || req.max_step > 1000)) {
    throw new UhpError(400, "invalid_request_error", "invalid_request", "`max_step` must be a non-negative integer.", "max_step");
  }

  const core: TurnCore = { st: Date.now(), m: req.model ?? "", x: req.max_step ?? null, i: ignored, r: nonce(4) };
  let spec: RunSpec;
  if (prev) {
    spec = { ...prev, turns: [...prev.turns, core] };
    const sid = sessionId(spec);
    const running = registry.active.get(sid);
    if (running) {
      throw new UhpError(409, "invalid_request_error", "session_busy", "This session is already running a task.", "previous_response_id", { response_id: running });
    }
  } else {
    // The scripted server needs to know which canned task to replay. metadata.task_id picks it;
    // otherwise the input text is matched against the task prompts.
    const text = inputText(req.input).trim();
    const task =
      taskById(typeof metadata.task_id === "string" ? metadata.task_id : undefined) ??
      TASKS.find((t) => t.prompt === text) ??
      TASKS[0];
    spec = { h: harness.base, t: task.id, s: nonce(8), turns: [core] };
  }

  const run = buildRun(spec, origin);
  if (!run) throw new UhpError(500, "server_error", "server_error", "No script for this harness and task.");
  registry.latest.set(sessionId(spec), run.id);
  return { run, req };
}

export function loadRun(id: string, origin: string): BuiltRun {
  const spec = decodeResponseId(id);
  const run = spec && buildRun(spec, origin);
  if (!run) throw notFound("response_not_found", `Response ${id}`);
  return run;
}

/** The stored response: the source of truth, rebuilt deterministically from the id. */
export function storedResponse(run: BuiltRun, now = Date.now()): UhpResponse {
  const cancelAt = registry.cancels.get(run.id);
  if (cancelAt !== undefined) return cancelledResponse(run, cancelAt);
  return responseAt(run, now - thisTurn(run.spec).st);
}

/** POST /v1/responses/{id}/cancel. Idempotent; a terminal response is returned unchanged. */
export function cancelRun(run: BuiltRun, now = Date.now()): UhpResponse {
  const elapsed = now - thisTurn(run.spec).st;
  if (!registry.cancels.has(run.id) && elapsed < run.duration) registry.cancels.set(run.id, Math.max(0, elapsed));
  return storedResponse(run, now);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Serialised SSE messages for a run, paced in real time. The loop checks the cancel registry
 * every tick; on cancel it emits the same tail the stored response is rebuilt from.
 */
export async function* streamRun(run: BuiltRun): AsyncGenerator<string> {
  const sid = sessionId(run.spec);
  const start = thisTurn(run.spec).st;
  let seq = 0;
  const emit = (body: object) => `data: ${JSON.stringify({ ...body, sequence_number: seq++ })}\n\n`;
  registry.active.set(sid, run.id);
  try {
    for (const [i, e] of run.timeline.entries()) {
      const terminal = i === run.timeline.length - 1;
      for (;;) {
        const cancelAt = registry.cancels.get(run.id);
        if (cancelAt !== undefined && (e.at > cancelAt || terminal)) {
          const tail = cancelTail(run, cancelAt);
          if (tail.length) {
            for (const body of tail) yield emit(body);
            return;
          }
        }
        const wait = start + e.at - Date.now();
        if (wait <= 0) break;
        await sleep(Math.min(wait, 50));
      }
      yield emit(e.body);
    }
  } finally {
    if (registry.active.get(sid) === run.id) registry.active.delete(sid);
  }
}

/** Non-streaming: block until the run ends (or is cancelled), then return the same response. */
export async function waitForRun(run: BuiltRun): Promise<UhpResponse> {
  const sid = sessionId(run.spec);
  const end = thisTurn(run.spec).st + run.duration;
  registry.active.set(sid, run.id);
  try {
    while (Date.now() < end && !registry.cancels.has(run.id)) await sleep(50);
  } finally {
    if (registry.active.get(sid) === run.id) registry.active.delete(sid);
  }
  return storedResponse(run);
}

// ---- Sessions and files

/**
 * Resolve a session's turns. The latest response id encodes every turn, so the client can pass it
 * as `?latest=` (a scripted-server hint for cold instances); otherwise the warm registry is used.
 */
export function sessionTurns(id: string, url: URL): { spec: RunSpec | null; info: NonNullable<ReturnType<typeof decodeSessionId>> } {
  const info = decodeSessionId(id);
  if (!info || !harnessByBase(info.h) || !taskById(info.t)) throw notFound("session_not_found", `Session ${id}`);
  const latestId = url.searchParams.get("latest") ?? registry.latest.get(id);
  const spec = latestId ? decodeResponseId(latestId) : null;
  if (latestId && (!spec || sessionId(spec) !== id)) {
    throw new UhpError(400, "invalid_request_error", "invalid_request", "`latest` is not a response of this session.", "latest");
  }
  return { spec, info };
}

export function turnSpecs(spec: RunSpec | null): RunSpec[] {
  return spec ? spec.turns.map((_, k) => ({ ...spec, turns: spec.turns.slice(0, k + 1) })) : [];
}

export function sessionFiles(spec: RunSpec | null, origin: string): SessionFile[] {
  const files: SessionFile[] = [];
  for (const turnSpec of turnSpecs(spec)) {
    const run = buildRun(turnSpec, origin);
    if (!run) continue;
    const resp = storedResponse(run);
    for (const item of resp.output) {
      if (item.type !== "message") continue;
      for (const ann of item.content.flatMap((c) => c.annotations)) {
        const artifact = run.script.artifacts.find((a) => a.filename === ann.filename);
        files.push({
          id: ann.file_id,
          container_id: ann.container_id,
          filename: ann.filename,
          bytes: new TextEncoder().encode(artifact?.content ?? "").length,
          created_at: Math.floor((thisTurn(turnSpec).st + run.duration) / 1000),
        });
      }
    }
  }
  return files;
}

export function readArtifact(cid: string, fid: string) {
  const f = decodeFileId(fid);
  if (!f || containerId(f.s) !== cid) throw notFound("file_not_found", `File ${fid}`);
  const task = taskById(f.t);
  const script = task && turnScript(task, f.h, f.turn);
  const artifact = script?.artifacts[f.index];
  if (!artifact) throw notFound("file_not_found", `File ${fid}`);
  return artifact;
}
