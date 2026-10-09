"use client";

import { CheckCircle2, CircleSlash, Gavel, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { LaneView, RunView } from "@/lib/workflow/reduce";
import { ModelBadge, WorktreeBadge, formatTokens } from "./bits";

function Lane({ lane }: { lane: LaneView }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lane.text]);
  const judge = lane.role === "judge";
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-lg border bg-card text-xs",
        judge && "border-violet-500/50 ring-1 ring-violet-500/20",
        lane.status === "running" && "shadow-sm",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5 border-b px-2.5 py-1.5">
        {lane.status === "running" ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        ) : lane.status === "null" ? (
          <CircleSlash className="size-3.5 text-destructive" />
        ) : (
          <CheckCircle2 className="size-3.5 text-emerald-600" />
        )}
        {judge && <Gavel className="size-3.5 text-violet-600 dark:text-violet-300" />}
        <span className="min-w-0 truncate font-mono font-medium" title={lane.label}>
          {lane.label}
        </span>
        {lane.retries > 0 && (
          <span className="inline-flex items-center gap-0.5 text-amber-600">
            <RotateCcw className="size-3" />
            (retry {lane.retries})
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {lane.isolation === "worktree" && <WorktreeBadge />}
          <ModelBadge model={lane.model} />
        </span>
      </div>
      <div className="px-2.5 pt-1.5 text-[11px] leading-snug text-muted-foreground">
        {judge && <span className="font-medium text-violet-700 dark:text-violet-300">Judge · own context, not the author. </span>}
        {lane.context}
      </div>
      <pre ref={ref} className="max-h-28 min-h-10 overflow-auto whitespace-pre-wrap px-2.5 py-1.5 font-mono text-[11px] leading-snug">
        {lane.text}
        {lane.status === "running" && <span className="animate-pulse">▍</span>}
      </pre>
      {lane.judge && (
        <div className="space-y-1 border-t bg-violet-500/5 px-2.5 py-1.5">
          <div className="text-[10.5px] text-muted-foreground">
            <span className="font-medium">Rubric:</span> {lane.judge.rubric}
          </div>
          <ul className="space-y-0.5">
            {lane.judge.items.map((it) => (
              <li key={it.subject} className="flex items-baseline gap-1.5">
                <span className={cn("w-16 shrink-0 font-mono text-[10.5px] font-semibold", it.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                  {it.verdict}
                </span>
                <span className="truncate" title={it.note}>
                  {it.subject}
                  {it.note && <span className="text-muted-foreground"> · {it.note}</span>}
                </span>
              </li>
            ))}
          </ul>
          {lane.judge.pick && (
            <div className="text-[11px]">
              Pick: <span className="font-semibold">{lane.judge.pick}</span>
            </div>
          )}
        </div>
      )}
      <div className="mt-auto flex justify-between border-t px-2.5 py-1 font-mono text-[10.5px] text-muted-foreground">
        <span>{formatTokens(lane.tokens)} tokens</span>
        <span>{lane.status === "null" ? "null (filtered)" : lane.ms !== undefined ? `${(lane.ms / 1000).toFixed(1)}s` : "streaming"}</span>
      </div>
    </div>
  );
}

export function Lanes({ run }: { run: RunView }) {
  if (run.status === "idle")
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Approve the workflow to watch the script spawn its subagents.
      </div>
    );
  return (
    <div className="space-y-3">
      {run.phases.map((p, i) => {
        const lanes = p.lanes.map((id) => run.lanes[id]);
        const running = lanes.filter((l) => l.status === "running").length;
        return (
          <section key={p.title}>
            <div className="mb-1.5 flex items-baseline gap-2 text-xs">
              <span className="font-semibold">
                {i + 1}. {p.title}
              </span>
              <span className="text-muted-foreground">
                {lanes.length} agent{lanes.length === 1 ? "" : "s"}
                {running > 0 && ` · ${running} running in parallel`}
              </span>
            </div>
            <div className={cn("grid gap-2", lanes.length > 1 ? "sm:grid-cols-2 2xl:grid-cols-3" : "grid-cols-1")}>
              {lanes.map((l) => (
                <Lane key={l.id} lane={l} />
              ))}
            </div>
            {p.logs.map((m, j) => (
              <div key={j} className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                log: {m}
              </div>
            ))}
          </section>
        );
      })}
      {run.summary && <RunSummary run={run} />}
      {run.status === "error" && <div className="rounded-md border border-destructive/40 p-2 text-xs text-destructive">Script error: {run.error}</div>}
    </div>
  );
}

function RunSummary({ run }: { run: RunView }) {
  const w = run.summary!.workflow;
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-xs">
      <div className="mb-1 font-semibold">Run summary</div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono">
        <span>{w.agents} agents spawned</span>
        <span>{formatTokens(w.tokens)} tokens total</span>
        <span>{(w.ms / 1000).toFixed(1)}s wall time</span>
      </div>
      <div className="mt-2 text-muted-foreground">Script returned (lives in script variables, only this reaches Claude&apos;s context):</div>
      <pre className="mt-1 overflow-auto rounded bg-background p-2 font-mono text-[11px]">{JSON.stringify(w.result, null, 2)}</pre>
    </div>
  );
}
