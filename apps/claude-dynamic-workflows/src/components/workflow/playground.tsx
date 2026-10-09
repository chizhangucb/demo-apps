"use client";

import { useCallback, useReducer, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { initialRun, readEvents, reduce } from "@/lib/workflow/reduce";
import type { RunEvent, TaskView } from "@/lib/workflow/types";
import { Baseline } from "./baseline";
import { ComparisonStrip } from "./comparison";
import { Lanes } from "./lanes";
import { ApprovalCard, ScriptPanel, type Approval } from "./script-panel";

type Action = RunEvent | { type: "reset" };

function runReducer(state: typeof initialRun, a: Action) {
  return a.type === "reset" ? initialRun : reduce(state, a);
}

const SPEEDS = [0.5, 1, 2];

export function Playground({ tasks }: { tasks: TaskView[] }) {
  const [taskId, setTaskId] = useState(tasks[0].id);
  const [approval, setApproval] = useState<Approval>("pending");
  const [speed, setSpeed] = useState(1);
  const [run, dispatch] = useReducer(runReducer, initialRun);
  const abortRef = useRef<AbortController | null>(null);
  const task = tasks.find((t) => t.id === taskId)!;

  const start = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setApproval("approved");
    dispatch({ type: "reset" });
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, speed }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      for await (const e of readEvents(res.body)) dispatch(e);
    } catch (err) {
      if (!ac.signal.aborted) dispatch({ type: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, [taskId, speed]);

  const pick = (id: string) => {
    abortRef.current?.abort();
    setTaskId(id);
    setApproval("pending");
    dispatch({ type: "reset" });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-2 md:grid-cols-3">
        {tasks.map((t) => (
          <button
            key={t.id}
            onClick={() => pick(t.id)}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
              t.id === taskId && "border-foreground/40 bg-muted/60 ring-1 ring-foreground/10",
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold">{t.title}</span>
              <span className="shrink-0 text-[10.5px] uppercase tracking-wide text-muted-foreground">{t.pattern}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t.blurb}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,27rem)_minmax(0,1fr)_minmax(0,22rem)]">
        <section className="min-w-0 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">1 · Task and generated workflow</h2>
          <div className="rounded-lg border p-3 text-xs">
            <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Prompt</div>
            <p className="mt-0.5 text-sm">&ldquo;{task.prompt}&rdquo;</p>
            <dl className="mt-2 space-y-1.5">
              {task.inputs.map((i) => (
                <div key={i.label}>
                  <dt className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{i.label}</dt>
                  <dd className="max-h-24 overflow-auto whitespace-pre-wrap">{i.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <ApprovalCard task={task} approval={approval} running={run.status === "running"} onRun={start} onDecline={() => setApproval("declined")} />
          <ScriptPanel task={task} />
        </section>

        <section className="min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">2 · Workflow run: parallel subagent lanes</h2>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              speed
              {SPEEDS.map((s) => (
                <button key={s} onClick={() => setSpeed(s)} className={cn("rounded px-1.5 font-mono", s === speed ? "bg-foreground text-background" : "hover:bg-muted")}>
                  {s}x
                </button>
              ))}
            </div>
          </div>
          <Lanes run={run} />
        </section>

        <section className="min-w-0 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">3 · Single-context baseline</h2>
          <Baseline task={task} run={run} />
        </section>
      </div>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comparison strip</h2>
        <ComparisonStrip task={task} run={run} />
      </section>
    </div>
  );
}
