import { describe, expect, test } from "bun:test";
import { HARNESSES, TASKS } from "../src/lib/catalog";
import { buildRun } from "../src/lib/uhp/engine";
import { decodeResponseId, encodeResponseId, type RunSpec } from "../src/lib/uhp/ids";
import { applyEvent, isGapless } from "../src/lib/uhp/reduce";
import type { StreamEvent, UhpResponse } from "../src/lib/uhp/types";
import { cancelRun, createRun, storedResponse, streamRun, UhpError, waitForRun } from "../src/server/uhp";

const byBase = (base: string) => HARNESSES.find((h) => h.base === base)!;

/** A run whose start lies far in the past, so the paced stream emits everything at once. */
function pastRun(base: string, taskId: string, over: Partial<RunSpec["turns"][number]> = {}) {
  const spec: RunSpec = { h: base, t: taskId, s: "testsess", turns: [{ st: Date.now() - 600_000, m: "", x: null, i: [], r: "abcd", ...over }] };
  return buildRun(spec)!;
}

async function collect(gen: AsyncGenerator<string>): Promise<StreamEvent[]> {
  const out: StreamEvent[] = [];
  for await (const chunk of gen) out.push(JSON.parse(chunk.replace(/^data: /, "")));
  return out;
}

const terminal = (events: StreamEvent[]) =>
  events.filter((e) => e.type === "response.completed" || e.type === "response.incomplete" || e.type === "response.failed");

describe("scripted UHP engine", () => {
  for (const h of HARNESSES) {
    for (const task of TASKS) {
      test(`${h.base} / ${task.id}: gapless, one terminal, stream == non-stream`, async () => {
        const run = pastRun(h.base, task.id);
        const events = await collect(streamRun(run));
        expect(events[0].type).toBe("response.created");
        expect(isGapless(events)).toBe(true);
        expect(terminal(events)).toHaveLength(1);
        expect(events.at(-1)!.type).toBe("response.completed");

        // Folding the stream gives the same response as the non-streaming call.
        let folded: UhpResponse | null = null;
        for (const e of events) folded = applyEvent(folded, e);
        const nonStream = await waitForRun(run);
        expect(nonStream.output).toEqual(folded!.output);
        expect(nonStream).toEqual(run.final);
      });
    }
  }

  test("every item is added before its deltas and done after them", async () => {
    const events = await collect(streamRun(pastRun("codex", "fix-failing-test")));
    const added = new Map<number, number>();
    const done = new Map<number, number>();
    for (const e of events) {
      if (!("output_index" in e)) continue;
      if (e.type === "response.output_item.added") added.set(e.output_index, e.sequence_number);
      else if (e.type === "response.output_item.done") done.set(e.output_index, e.sequence_number);
      else {
        expect(added.get(e.output_index)).toBeLessThan(e.sequence_number);
        expect(done.has(e.output_index)).toBe(false);
      }
    }
  });

  test("Hermes reports usage: null, never a fabricated zero", () => {
    expect(pastRun("hermes", "summarise-readme").final.usage).toBeNull();
    expect(pastRun("codex", "summarise-readme").final.usage!.total_tokens).toBeGreaterThan(0);
  });

  test("max_step below the step count ends incomplete with partial output", async () => {
    const run = pastRun("claude-code", "research-brief", { x: 3 });
    const events = await collect(streamRun(run));
    expect(events.at(-1)!.type).toBe("response.incomplete");
    expect(run.final.status).toBe("incomplete");
    expect(run.final.incomplete_details).toEqual({ reason: "max_step" });
    expect(run.final.output.filter((o) => o.type === "function_call")).toHaveLength(3);
    expect(run.final.output.some((o) => o.type === "message")).toBe(false);
  });

  test("cancel keeps partial output, reports cancelled, and the stream agrees", async () => {
    const probe = pastRun("claude-code", "research-brief");
    // Start the run so that "now" is half way through its script.
    const run = buildRun({ ...probe.spec, s: "cancelme", turns: [{ ...probe.spec.turns[0], st: Date.now() - probe.duration / 2 }] })!;
    const cancelled = cancelRun(run);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.error).toBeNull();
    expect(cancelled.output.length).toBeGreaterThan(0);
    expect(cancelled.output.length).toBeLessThan(run.final.output.length);

    const events = await collect(streamRun(run));
    expect(isGapless(events)).toBe(true);
    const last = events.at(-1)!;
    expect(last.type).toBe("response.failed");
    if (last.type === "response.failed") expect(last.response).toEqual(cancelled);
    expect(terminal(events)).toHaveLength(1);

    // Cancel is idempotent and the stored response is the source of truth.
    expect(cancelRun(run)).toEqual(cancelled);
    expect(storedResponse(run)).toEqual(cancelled);
  });

  test("cancelling a finished response changes nothing", () => {
    const run = pastRun("pi", "summarise-readme");
    expect(cancelRun(run)).toEqual(run.final);
  });

  test("response ids round-trip", () => {
    const run = pastRun("hermes", "fix-failing-test", { m: "nousresearch/hermes-4-70b", x: 4, i: ["tools"] });
    expect(decodeResponseId(run.id)).toEqual(run.spec);
    expect(encodeResponseId(run.spec)).toBe(run.id);
  });
});

describe("request handling", () => {
  const body = (harness: string, extra: Record<string, unknown> = {}) => ({
    input: TASKS[0].prompt,
    metadata: { harness_id: byBase(harness).id, task_id: TASKS[0].id },
    stream: true,
    ...extra,
  });

  test("continuing a session on a different harness is a 409 harness_mismatch envelope", async () => {
    const { run } = createRun(body("codex"), "http://x");
    let caught: unknown;
    try {
      createRun(body("claude-code", { previous_response_id: run.id, input: "Now make it shorter." }), "http://x");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(UhpError);
    const res = (caught as UhpError).toResponse();
    expect(res.status).toBe(409);
    expect(res.headers.get("UHP-Version")).toBe("2026-10-04");
    const env = await res.json();
    expect(env.error.type).toBe("invalid_request_error");
    expect(env.error.code).toBe("harness_mismatch");
  });

  test("a follow-up keeps the session id and links previous_response_id", () => {
    const first = createRun(body("pi"), "http://x").run;
    const second = createRun({ input: "Now make it shorter.", previous_response_id: first.id, stream: true }, "http://x").run;
    expect(second.final.metadata.session_id).toBe(first.final.metadata.session_id);
    expect(second.final.previous_response_id).toBe(first.id);
    expect(second.final.metadata.harness_id).toBe(byBase("pi").id);
  });

  test("tools and unknown fields are listed in ignored_fields", () => {
    const { run } = createRun(body("codex", { tools: [], include: ["x"], foo: 1 }), "http://x");
    expect(run.final.metadata.ignored_fields).toEqual(["tools", "include", "foo"]);
  });

  test("model substitution is visible; Hermes refuses with 422 model_unavailable", () => {
    const { run } = createRun(body("claude-code", { model: "gpt-5.4" }), "http://x");
    expect(run.final.model).toBe("claude-sonnet-4.6");
    expect(run.final.metadata.model_fallback).toBe(true);
    expect(run.final.metadata.requested_model).toBe("gpt-5.4");
    try {
      createRun(body("hermes", { model: "gpt-5.4" }), "http://x");
      throw new Error("expected 422");
    } catch (err) {
      expect((err as UhpError).status).toBe(422);
      expect((err as UhpError).code).toBe("model_unavailable");
    }
  });

  test("unknown harness is 404 harness_not_found", () => {
    expect(() => createRun({ input: "hi", metadata: { harness_id: "chrn_nope" } }, "http://x")).toThrow(UhpError);
  });
});
