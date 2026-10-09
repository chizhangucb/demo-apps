import { describe, expect, test } from "bun:test";
import { getTask, listTasks } from "../src/lib/tasks";
import { runTask } from "../src/lib/workflow/run";
import { readMeta, runWorkflow, type AgentCall, type RuntimeHost } from "../src/lib/workflow/runtime";
import type { RunEvent } from "../src/lib/workflow/types";

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

function echoHost(delayMs = 0, log: string[] = []): RuntimeHost {
  return {
    async agent(call: AgentCall) {
      log.push(`start ${call.options.label}`);
      await tick(delayMs);
      log.push(`end ${call.options.label}`);
      return call.options.label === "null" ? null : { label: call.options.label, phase: call.phase };
    },
  };
}

describe("runtime", () => {
  test("runs a script and returns its value", async () => {
    const src = `export const meta = { name: 't', description: 'd' }\nphase('One')\nconst r = await agent('hi', { label: 'x' })\nreturn { got: r.label, phase: r.phase, arg: args.n }`;
    expect(await runWorkflow(src, { args: { n: 3 }, host: echoHost() })).toEqual({ got: "x", phase: "One", arg: 3 });
    expect(readMeta(src)).toEqual({ name: "t", description: "d" });
  });

  test("parallel is a barrier", async () => {
    const log: string[] = [];
    const src = `await parallel([() => agent('a', { label: 'a' }), () => agent('b', { label: 'b' })])\nawait agent('c', { label: 'c' })`;
    await runWorkflow(src, { host: echoHost(5, log) });
    expect(log.indexOf("start c")).toBeGreaterThan(log.indexOf("end a"));
    expect(log.indexOf("start c")).toBeGreaterThan(log.indexOf("end b"));
    expect(log.indexOf("start b")).toBeLessThan(log.indexOf("end a"));
  });

  test("pipeline keeps null slots and filter(Boolean) drops them", async () => {
    const src = `const r = await pipeline(['a', 'null', 'b'], l => agent(l, { label: l }), v => v.label.toUpperCase())\nreturn { r, kept: r.filter(Boolean).length }`;
    expect(await runWorkflow(src, { host: echoHost() })).toEqual({ r: ["A", null, "B"], kept: 2 });
  });

  test("a failing agent resolves to null", async () => {
    const host: RuntimeHost = { agent: async () => { throw new Error("boom"); } };
    expect(await runWorkflow(`return await agent('x')`, { host })).toBeNull();
  });

  test.each(["Date.now()", "new Date()", "Math.random()"])("%s throws", async (expr) => {
    await expect(runWorkflow(`return ${expr}`, { host: echoHost() })).rejects.toThrow("not available in a workflow script");
  });

  test("import(), eval and host escapes are blocked", async () => {
    await expect(runWorkflow(`await import('node:fs')`, { host: echoHost() })).rejects.toThrow("import()");
    await expect(runWorkflow(`return eval('1')`, { host: echoHost() })).rejects.toThrow();
    await expect(runWorkflow(`return agent.constructor('return process')()`, { host: echoHost() })).rejects.toThrow();
    // Values crossing the bridge are rebuilt in the sandbox realm, so they do not reach host constructors.
    const leak = `const r = await agent('x', { label: 'x' })\nreturn typeof r.constructor.constructor('return typeof process')`;
    await expect(runWorkflow(leak, { host: echoHost() })).rejects.toThrow();
  });

  test("concurrency is capped at 16", async () => {
    let active = 0;
    let peak = 0;
    const host: RuntimeHost = {
      async agent() {
        peak = Math.max(peak, ++active);
        await tick(2);
        active--;
        return 1;
      },
    };
    const out = await runWorkflow(`const r = await parallel(Array.from({ length: 40 }, (_, i) => () => agent('x' + i)))\nreturn r.length`, { host });
    expect(out).toBe(40);
    expect(peak).toBe(16);
  });

  test("item and agent limits are enforced", async () => {
    await expect(runWorkflow(`await parallel(Array.from({ length: 5 }, () => () => 1))`, { host: echoHost(), limits: { maxItems: 4 } })).rejects.toThrow("at most 4 items");
    await expect(runWorkflow(`await agent('a')\nawait agent('b')`, { host: echoHost(), limits: { maxAgents: 1 } })).rejects.toThrow("agent limit");
  });
});

async function collect(id: string) {
  const task = getTask(id)!;
  const events: RunEvent[] = [];
  await runTask(task, (e) => events.push(e), { chunkMs: 0 });
  return events;
}

describe("scripted presets", () => {
  test("three presets load with their scripts", () => {
    const tasks = listTasks();
    expect(tasks.map((t) => t.id)).toEqual(["cli-name-tournament", "business-plan-teardown", "blog-claim-check"]);
    for (const t of tasks) expect(t.meta.phases?.map((p) => p.title)).toEqual(t.plan.map((p) => p.title));
  });

  test("the tournament bracket yields a winner and a top 3", async () => {
    const events = await collect("cli-name-tournament");
    const done = events.find((e) => e.type === "run_done");
    expect(done?.type === "run_done" && done.workflow.result).toEqual({ top3: ["skiff", "stagelet", "shp"] });
    const bouts = events.filter((e) => e.type === "agent_start" && /^r\d+:/.test(e.label));
    expect(bouts).toHaveLength(9);
    const finalJudge = events.find((e) => e.type === "judge" && e.label === "judge: final ranking");
    expect(finalJudge?.type === "judge" && finalJudge.pick).toBe("skiff");
  });

  test("planned agent counts match what each script spawns", async () => {
    for (const task of listTasks()) {
      const events = await collect(task.id);
      const starts = events.filter((e) => e.type === "agent_start");
      expect(starts.length).toBe(task.plan.reduce((n, p) => n + p.agents, 0));
      for (const p of task.plan) expect(starts.filter((e) => e.type === "agent_start" && e.phase === p.title).length).toBe(p.agents);
      expect(events.filter((e) => e.type === "baseline_marker").map((e) => e.type === "baseline_marker" && e.kind)).toEqual(
        expect.arrayContaining(["early_stop", "self_grade", "compaction"]),
      );
    }
  });

  test("blog check: code claims run in a worktree, the skeptic drops a false positive", async () => {
    const events = await collect("blog-claim-check");
    const worktrees = events.filter((e) => e.type === "agent_start" && e.isolation === "worktree");
    expect(worktrees).toHaveLength(9);
    expect(events.some((e) => e.type === "agent_retry")).toBe(true);
    const done = events.find((e) => e.type === "run_done");
    expect(done?.type === "run_done" && done.workflow.result).toEqual({ checked: 12, total: 12, wrong: ["c2", "c4", "c9", "c10"] });
  });
});
