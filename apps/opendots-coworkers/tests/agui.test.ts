import { describe, expect, test } from "bun:test";
import { applyPatch, encodeSse, readSse, type AguiEvent, type RunAgentInput } from "../src/lib/agui";
import { defaultPermissions } from "../src/lib/catalog";
import { emptyView, reduce } from "../src/lib/run-view";
import { runAgent } from "../src/server/agent";

const noDelay = async () => {};

function input(over: Partial<RunAgentInput> = {}): RunAgentInput {
  return {
    threadId: "t1",
    runId: "r1",
    messages: [],
    tools: [],
    context: [],
    state: {},
    forwardedProps: { taskId: "competitor-brief", permissions: defaultPermissions() },
    ...over,
  };
}

async function collect(gen: AsyncGenerator<AguiEvent>) {
  const out: AguiEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

describe("SSE encoder + reader", () => {
  test("round-trips events split across chunks", async () => {
    const events: AguiEvent[] = [
      { type: "RUN_STARTED", threadId: "t", runId: "r" },
      { type: "TEXT_MESSAGE_CONTENT", messageId: "m", delta: "hé\n\nllo" },
      { type: "RUN_FINISHED", threadId: "t", runId: "r" },
    ];
    const bytes = Buffer.concat(events.map((e) => Buffer.from(encodeSse(e))));
    expect(new TextDecoder().decode(encodeSse(events[0]))).toStartWith("data: {");
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.subarray(i, i + 7));
        c.close();
      },
    });
    const got = await collect(readSse(body));
    expect(got.map((e) => e.type)).toEqual(["RUN_STARTED", "TEXT_MESSAGE_CONTENT", "RUN_FINISHED"]);
    expect((got[1] as { delta: string }).delta).toBe("hé\n\nllo");
  });

  test("applyPatch appends and replaces", () => {
    const doc = { a: [1], b: { c: 1 } };
    expect(applyPatch(doc, [{ op: "add", path: "/a/-", value: 2 }, { op: "replace", path: "/b/c", value: 3 }])).toEqual({
      a: [1, 2],
      b: { c: 3 },
    });
    expect(doc.a).toEqual([1]);
  });
});

describe("scripted agent", () => {
  test("Writer is denied the browser and the run pauses for review", async () => {
    const events = await collect(runAgent(input(), { delay: noDelay }));
    expect(events[0].type).toBe("RUN_STARTED");
    const last = events.at(-1)!;
    expect(last.type).toBe("RUN_FINISHED");
    expect(last.type === "RUN_FINISHED" && last.outcome?.type).toBe("interrupt");
    const denied = events.filter((e) => e.type === "CUSTOM" && e.name === "permission_denied");
    expect(denied).toHaveLength(1);
    expect((denied[0] as { value: { dot: string; tool: string } }).value).toMatchObject({ dot: "writer", tool: "browser.navigate" });

    const view = events.reduce(reduce, emptyView());
    expect(view.status).toBe("review");
    expect(view.state.findings).toHaveLength(4);
    expect(view.state.draft?.title).toContain("comparison");
    expect(view.computers.writer.activity.find((a) => a.status === "denied")?.reason).toBe("browser permission disabled");
    expect(view.computers.researcher.files.map((f) => f.path)).toContain("notes.md");
  });

  test("enabling Writer browser removes the denial; disabling Researcher browser drops sources", async () => {
    const perms = defaultPermissions();
    perms.writer.browser = true;
    perms.researcher.browser = false;
    const events = await collect(
      runAgent(input({ forwardedProps: { taskId: "competitor-brief", permissions: perms } }), { delay: noDelay }),
    );
    const view = events.reduce(reduce, emptyView());
    expect(view.denials.map((d) => `${d.dot}:${d.tool}`)).toEqual(["researcher:browser.navigate", "researcher:browser.snapshot"]);
    expect(view.state.findings.every((f) => f.source === null)).toBe(true);
  });

  test("each canned task has its scripted denial", async () => {
    const expected: Record<string, string> = {
      "competitor-brief": "writer:browser.navigate",
      "launch-notes": "writer:shell.run",
      "meeting-prep": "researcher:files.read",
    };
    for (const [taskId, denial] of Object.entries(expected)) {
      const events = await collect(
        runAgent(input({ forwardedProps: { taskId, permissions: defaultPermissions() } }), { delay: noDelay }),
      );
      const view = events.reduce(reduce, emptyView());
      expect(view.denials.map((d) => `${d.dot}:${d.tool}`)).toEqual([denial]);
    }
  });

  test("resume: approve saves the page, missing savePage permission denies it", async () => {
    const first = (await collect(runAgent(input(), { delay: noDelay }))).reduce(reduce, emptyView());
    const resume = [{ interruptId: first.interrupt!.id, status: "approved" as const }];
    const ok = (await collect(runAgent(input({ runId: "r2", state: first.state, resume }), { delay: noDelay }))).reduce(
      reduce,
      first,
    );
    expect(ok.status).toBe("done");
    expect(ok.state.savedPage?.space).toBe("Drafts");

    const perms = defaultPermissions();
    perms.writer.savePage = false;
    const denied = (
      await collect(
        runAgent(input({ runId: "r3", state: first.state, resume, forwardedProps: { permissions: perms } }), { delay: noDelay }),
      )
    ).reduce(reduce, first);
    expect(denied.state.savedPage).toBeNull();
    expect(denied.denials.at(-1)?.tool).toBe("page.save");
  });
});
