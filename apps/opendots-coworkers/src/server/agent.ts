import type { AguiEvent, JsonPatchOp, RunAgentInput } from "@/lib/agui";
import { getDot, getTask, TASKS } from "@/lib/catalog";
import { checkTool, normalizePermissions } from "@/lib/permissions";
import type {
  ActivityRow,
  Computer,
  DotId,
  Draft,
  ForwardedProps,
  RunState,
  ScriptStep,
  Task,
} from "@/lib/types";

/** Streams the Writer's page body. Present only when live mode is configured. */
export type LiveWriter = (task: Task, findings: Task["findings"]) => AsyncIterable<string>;

export type AgentOptions = {
  delay?: (ms: number) => Promise<void>;
  live?: LiveWriter;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Typed tasks reuse the closest canned script; the prompt the user typed is kept in state. */
export function pickTask(taskId: string | undefined, prompt: string | undefined): Task {
  const canned = getTask(taskId);
  if (canned) return canned;
  const p = (prompt ?? "").toLowerCase();
  const base = /release|launch|changelog|ship/.test(p)
    ? TASKS[1]
    : /customer|meeting|call|prep|account/.test(p)
      ? TASKS[2]
      : TASKS[0];
  return prompt?.trim() ? { ...base, id: `custom:${base.id}`, title: "Custom task", prompt: prompt.trim().slice(0, 500) } : base;
}

export function emptyComputer(dot: DotId): Computer {
  return { dot, browser: null, files: [], terminal: [], activity: [] };
}

/**
 * The scripted coworker run. Walks a canned task through Researcher then Writer,
 * gating every simulated tool call server-side, and pauses on an interrupt for review.
 * A second call carrying `resume` answers that interrupt (Approve & save / Decline).
 */
export async function* runAgent(input: RunAgentInput, opts: AgentOptions = {}): AsyncGenerator<AguiEvent> {
  const delay = opts.delay ?? sleep;
  const { threadId, runId } = input;
  const fp = (input.forwardedProps ?? {}) as ForwardedProps;
  const perms = normalizePermissions(fp.permissions);
  let ids = 0;
  const id = (p: string) => `${p}-${runId}-${++ids}`;

  yield { type: "RUN_STARTED", threadId, runId };

  // ---- text + tool helpers -------------------------------------------------
  async function* say(sub: string | undefined, text: string): AsyncGenerator<AguiEvent> {
    const messageId = id("msg");
    yield { type: "TEXT_MESSAGE_START", messageId, role: "assistant", subagentRunId: sub };
    for (const chunk of text.match(/\S+\s*|\s+/g) ?? []) {
      yield { type: "TEXT_MESSAGE_CONTENT", messageId, delta: chunk, subagentRunId: sub };
      await delay(18);
    }
    yield { type: "TEXT_MESSAGE_END", messageId, subagentRunId: sub };
  }

  function activity(dot: DotId, patch: JsonPatchOp[], sub?: string): AguiEvent {
    return { type: "ACTIVITY_DELTA", messageId: `computer-${dot}`, activityType: "COMPUTER", patch, subagentRunId: sub };
  }

  /** Runs one scripted tool call through the gate. Returns false when denied. */
  async function* tool(
    dot: DotId,
    sub: string,
    name: string,
    args: Record<string, unknown>,
    output: string,
  ): AsyncGenerator<AguiEvent, boolean> {
    const toolCallId = id("call");
    const json = JSON.stringify(args);
    const half = Math.ceil(json.length / 2);
    yield { type: "TOOL_CALL_START", toolCallId, toolCallName: name, subagentRunId: sub };
    yield { type: "TOOL_CALL_ARGS", toolCallId, delta: json.slice(0, half), subagentRunId: sub };
    await delay(60);
    yield { type: "TOOL_CALL_ARGS", toolCallId, delta: json.slice(half), subagentRunId: sub };
    yield { type: "TOOL_CALL_END", toolCallId, subagentRunId: sub };
    await delay(220);

    const gate = checkTool(dot, name, args, perms);
    const dotName = getDot(dot).name;
    // Activity rows record action, requester and outcome only: no file contents, typed values or commands.
    const row: ActivityRow = {
      id: toolCallId,
      action: name,
      requestedBy: dotName,
      status: gate.allowed ? "allowed" : "denied",
      reason: gate.allowed ? undefined : gate.reason,
      at: Date.now(),
    };

    if (!gate.allowed) {
      yield {
        type: "TOOL_CALL_RESULT",
        messageId: id("tool"),
        toolCallId,
        role: "tool",
        content: JSON.stringify({ error: "permission_denied", reason: gate.reason }),
        subagentRunId: sub,
      };
      yield {
        type: "CUSTOM",
        name: "permission_denied",
        value: { dot, dotName, tool: name, reason: gate.reason, toolCallId },
        subagentRunId: sub,
      };
      yield activity(dot, [{ op: "add", path: "/activity/-", value: row }], sub);
      return false;
    }

    const patch: JsonPatchOp[] = [];
    if (name === "browser.navigate") {
      const url = String(args.url);
      patch.push({ op: "replace", path: "/browser", value: { url, title: new URL(url).hostname, snapshot: output } });
    } else if (name === "browser.snapshot") {
      patch.push({ op: "replace", path: "/browser/snapshot", value: output });
    } else if (name === "files.write") {
      patch.push({ op: "add", path: "/files/-", value: { path: String(args.path), bytes: Number(args.bytes ?? 0) } });
    } else if (name === "shell.run") {
      patch.push({ op: "add", path: "/terminal/-", value: `$ ${String(args.command)}` });
      for (const line of output.split("\n")) patch.push({ op: "add", path: "/terminal/-", value: line });
    }
    patch.push({ op: "add", path: "/activity/-", value: row });
    yield activity(dot, patch, sub);
    yield { type: "TOOL_CALL_RESULT", messageId: id("tool"), toolCallId, role: "tool", content: output, subagentRunId: sub };
    return true;
  }

  async function* script(dot: DotId, sub: string, steps: ScriptStep[]): AsyncGenerator<AguiEvent, string[]> {
    const denied: string[] = [];
    for (const step of steps) {
      if ("say" in step) {
        yield* say(sub, step.say);
      } else {
        const ok = yield* tool(dot, sub, step.tool, step.args, step.output);
        if (!ok) denied.push(step.tool);
        const follow = ok ? step.onAllowed : step.onDenied;
        if (follow) yield* say(sub, follow);
      }
      await delay(200);
    }
    return denied;
  }

  // ---- resume: answer the review interrupt ----------------------------------
  if (input.resume?.length) {
    const answer = input.resume[0];
    const state = (input.state ?? {}) as RunState;
    const draft = cleanDraft(state.draft);
    const writer = getDot("writer");
    const sub = `${runId}:writer`;
    yield { type: "SUBAGENT_STARTED", subagentRunId: sub, name: writer.name, description: writer.role };
    yield { type: "STEP_STARTED", stepName: "review", subagentRunId: sub };

    let saved = false;
    if (answer.status !== "approved" || !draft) {
      yield* say(sub, "Draft declined. Nothing was saved.");
    } else {
      const ok = yield* tool("writer", sub, "page.save", { space: writer.space, title: draft.title }, "saved");
      if (ok) {
        const savedPage = { ...draft, id: `page-${runId}`, space: writer.space, savedAt: Date.now() };
        yield { type: "STATE_SNAPSHOT", snapshot: { ...state, draft, savedPage } satisfies RunState };
        yield* say(sub, `Saved "${draft.title}" to the ${writer.space} Space. It's open in the editor.`);
        saved = true;
      } else {
        yield* say(sub, "I'm not allowed to save pages. The draft stays unsaved.");
      }
    }
    yield { type: "STEP_FINISHED", stepName: "review", subagentRunId: sub };
    yield { type: "SUBAGENT_FINISHED", subagentRunId: sub, result: { saved } };
    yield { type: "RUN_FINISHED", threadId, runId, outcome: { type: "success" }, result: { saved } };
    return;
  }

  // ---- fresh run ------------------------------------------------------------
  const lastUser = [...(input.messages ?? [])].reverse().find((m) => m.role === "user");
  const task = pickTask(fp.taskId, fp.taskId ? undefined : lastUser?.content);
  const initial: RunState = {
    task: { id: task.id, title: task.title, prompt: task.prompt },
    findings: [],
    draft: null,
    savedPage: null,
  };
  yield { type: "STATE_SNAPSHOT", snapshot: initial };
  for (const dot of ["researcher", "writer"] as const) {
    yield { type: "ACTIVITY_SNAPSHOT", messageId: `computer-${dot}`, activityType: "COMPUTER", content: emptyComputer(dot) };
  }

  // Researcher
  const researcher = getDot("researcher");
  const rSub = `${runId}:researcher`;
  yield { type: "SUBAGENT_STARTED", subagentRunId: rSub, name: researcher.name, description: researcher.role };
  yield { type: "STEP_STARTED", stepName: "research", subagentRunId: rSub };
  const rDenied = yield* script("researcher", rSub, task.researcher);
  const unsourced = rDenied.some((t) => t.startsWith("browser.") || t.startsWith("research."));
  const findings = task.findings.map((f) =>
    unsourced ? { ...f, detail: `${f.detail} (unverified: no sources)`, source: null } : f,
  );
  for (const f of findings) {
    yield* say(rSub, `• ${f.title}: ${f.detail}${f.source ? ` [${f.source}]` : ""}`);
    yield { type: "STATE_DELTA", delta: [{ op: "add", path: "/findings/-", value: f }], subagentRunId: rSub };
    await delay(120);
  }
  yield { type: "STEP_FINISHED", stepName: "research", subagentRunId: rSub };
  yield { type: "SUBAGENT_FINISHED", subagentRunId: rSub, result: { findings: findings.length, denied: rDenied } };

  // Visible handoff (upstream has no automatic delegation yet)
  yield { type: "STEP_STARTED", stepName: "handoff" };
  yield { type: "CUSTOM", name: "handoff", value: { from: "researcher", to: "writer", findings: findings.length, text: task.handoff } };
  await delay(400);
  yield { type: "STEP_FINISHED", stepName: "handoff" };

  // Writer
  const writer = getDot("writer");
  const wSub = `${runId}:writer`;
  yield { type: "SUBAGENT_STARTED", subagentRunId: wSub, name: writer.name, description: writer.role };
  yield { type: "STEP_STARTED", stepName: "draft", subagentRunId: wSub };
  const steps = task.writer;
  const head = steps.slice(0, -1);
  const tail = steps.slice(-1);
  const wDenied = yield* script("writer", wSub, head);

  // Stream the page body (live Claude if configured, otherwise the canned draft).
  let body = "";
  const messageId = id("draft");
  yield { type: "TEXT_MESSAGE_START", messageId, role: "assistant", subagentRunId: wSub };
  let streamed = false;
  if (opts.live) {
    try {
      for await (const delta of opts.live(task, findings)) {
        body += delta;
        yield { type: "TEXT_MESSAGE_CONTENT", messageId, delta, subagentRunId: wSub };
      }
      streamed = body.trim().length > 0;
    } catch (err) {
      yield { type: "CUSTOM", name: "live_error", value: { message: err instanceof Error ? err.message : String(err) } };
    }
  }
  if (!streamed) {
    body = "";
    for (const chunk of task.page.body.match(/\S+\s*|\s+/g) ?? []) {
      body += chunk;
      yield { type: "TEXT_MESSAGE_CONTENT", messageId, delta: chunk, subagentRunId: wSub };
      await delay(14);
    }
  }
  yield { type: "TEXT_MESSAGE_END", messageId, subagentRunId: wSub };
  const draft: Draft = {
    title: task.page.title,
    body,
    sources: findings.flatMap((f) => (f.source ? [f.source] : [])),
  };
  yield { type: "STATE_DELTA", delta: [{ op: "replace", path: "/draft", value: draft }], subagentRunId: wSub };
  yield* script("writer", wSub, tail);
  yield { type: "STEP_FINISHED", stepName: "draft", subagentRunId: wSub };
  yield { type: "SUBAGENT_FINISHED", subagentRunId: wSub, result: { denied: wDenied } };

  yield {
    type: "RUN_FINISHED",
    threadId,
    runId,
    outcome: {
      type: "interrupt",
      interrupts: [{ id: `review-${runId}`, reason: "review_page", payload: { draft, space: writer.space } }],
    },
  };
}

function cleanDraft(d: unknown): Draft | null {
  const x = d as Partial<Draft> | null | undefined;
  if (!x || typeof x.title !== "string" || typeof x.body !== "string") return null;
  return {
    title: x.title.slice(0, 200),
    body: x.body.slice(0, 20000),
    sources: Array.isArray(x.sources) ? x.sources.filter((s) => typeof s === "string").slice(0, 20) : [],
  };
}
