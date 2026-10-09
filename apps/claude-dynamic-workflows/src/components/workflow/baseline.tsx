"use client";

import { AlertTriangle, Archive, Flag, ThumbsUp } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { RunView } from "@/lib/workflow/reduce";
import type { MarkerKind, TaskView } from "@/lib/workflow/types";
import { ModelBadge, formatTokens } from "./bits";

const MARKER: Record<MarkerKind, { icon: typeof Flag; cls: string; tag: string }> = {
  early_stop: { icon: Flag, cls: "border-orange-500/50 bg-orange-500/10 text-orange-800 dark:text-orange-200", tag: "Early stop" },
  self_grade: { icon: ThumbsUp, cls: "border-rose-500/50 bg-rose-500/10 text-rose-800 dark:text-rose-200", tag: "Self-grading" },
  compaction: { icon: Archive, cls: "border-slate-500/50 bg-slate-500/10 text-slate-800 dark:text-slate-200", tag: "Compaction" },
  drift: { icon: AlertTriangle, cls: "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200", tag: "Goal drift" },
};

export function Baseline({ task, run }: { task: TaskView; run: RunView }) {
  const ref = useRef<HTMLDivElement>(null);
  const b = run.baseline;
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [b.items]);
  const window = task.baseline.window;
  const cov = b.coverage;
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border">
      <div className="space-y-2 border-b bg-muted/40 px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold">One agent, one context</span>
          <ModelBadge model={task.baseline.model} className="ml-auto" />
        </div>
        <Meter label="Context window" value={b.context} max={window} text={`${formatTokens(b.context)} / ${formatTokens(window)}`} warn={b.context > window * 0.6} />
        <Meter
          label="Coverage"
          value={cov ? cov[0] : 0}
          max={cov ? cov[1] : 1}
          text={cov ? `${cov[0]} of ${cov[1]}` : "not started"}
          warn={!!cov && b.done && cov[0] < cov[1]}
        />
      </div>
      <div ref={ref} className="max-h-[36rem] min-h-48 flex-1 space-y-2 overflow-auto p-3 text-[12px] leading-relaxed">
        {run.status === "idle" && <div className="text-muted-foreground">The same task, done by one agent in one long context, streams here beside the workflow.</div>}
        {b.items.map((it, i) =>
          it.kind === "text" ? (
            <p key={i} className={cn("whitespace-pre-line", it.drift && "rounded bg-rose-500/10 decoration-rose-500 decoration-wavy underline-offset-4 [text-decoration-line:underline]")}>
              {it.text.trimEnd()}
            </p>
          ) : (
            <Marker key={i} kind={it.marker} title={it.title} detail={it.detail} />
          ),
        )}
      </div>
      <div className="flex justify-between border-t px-3 py-1 font-mono text-[10.5px] text-muted-foreground">
        <span>{formatTokens(b.tokens)} tokens</span>
        <span>{b.done ? `done in ${((b.ms ?? 0) / 1000).toFixed(1)}s` : run.status === "running" ? "streaming" : ""}</span>
      </div>
    </div>
  );
}

function Marker({ kind, title, detail }: { kind: MarkerKind; title: string; detail: string }) {
  const m = MARKER[kind];
  const Icon = m.icon;
  return (
    <div className={cn("rounded-md border px-2.5 py-1.5 text-[11.5px]", m.cls)}>
      <div className="flex items-center gap-1.5 font-semibold">
        <Icon className="size-3.5" />
        <span className="uppercase tracking-wide text-[10px] opacity-80">{m.tag}</span>
        <span>{title}</span>
      </div>
      <div className="mt-0.5 leading-snug">{detail}</div>
    </div>
  );
}

function Meter({ label, value, max, text, warn }: { label: string; value: number; max: number; text: string; warn?: boolean }) {
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-mono", warn && "text-orange-600 dark:text-orange-400")}>{text}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", warn ? "bg-orange-500" : "bg-foreground/60")} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
    </div>
  );
}
