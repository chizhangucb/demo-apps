"use client";

import { Check, Code2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { TaskView } from "@/lib/workflow/types";
import { highlight } from "./bits";

export type Approval = "pending" | "approved" | "declined";

function sizeLabel(n: number) {
  if (n < 5) return "small";
  if (n < 10) return "medium";
  if (n < 50) return "large";
  return "very large";
}

export function ApprovalCard({ task, approval, running, onRun, onDecline }: { task: TaskView; approval: Approval; running: boolean; onRun: () => void; onDecline: () => void }) {
  const total = task.plan.reduce((n, p) => n + p.agents, 0);
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-medium">
          Run workflow <span className="font-mono">{task.meta.name}</span>?
        </div>
        <span className="text-xs text-muted-foreground">
          {total} agents · {sizeLabel(total)}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{task.meta.description}</p>
      <ol className="mt-2 space-y-0.5 font-mono text-xs">
        {task.plan.map((p, i) => (
          <li key={p.title} className="flex justify-between">
            <span>
              {i + 1}. {p.title}
            </span>
            <span className="text-muted-foreground">
              {p.agents} agent{p.agents === 1 ? "" : "s"}
            </span>
          </li>
        ))}
      </ol>
      {approval === "declined" ? (
        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Not run. Claude would carry on in one context.</span>
          <Button size="sm" variant="outline" onClick={onRun}>
            Run it anyway
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Button size="sm" onClick={onRun} disabled={running}>
            <Check /> {approval === "approved" && !running ? "Run again" : "Yes, run it"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => document.getElementById("raw-script")?.scrollIntoView({ behavior: "smooth", block: "nearest" })}>
            <Code2 /> View raw script
          </Button>
          <Button size="sm" variant="ghost" onClick={onDecline} disabled={running}>
            <X /> No
          </Button>
        </div>
      )}
    </div>
  );
}

export function ScriptPanel({ task }: { task: TaskView }) {
  const [raw, setRaw] = useState(false);
  const lines = task.source.split("\n").length;
  return (
    <div id="raw-script" className="overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-1.5 text-xs">
        <span className="font-mono">
          {task.script} <span className="text-muted-foreground">· {lines} lines · written by Claude for this task</span>
        </span>
        <button className="text-muted-foreground underline-offset-2 hover:underline" onClick={() => setRaw((r) => !r)}>
          {raw ? "highlight" : "raw"}
        </button>
      </div>
      <pre className="max-h-[30rem] overflow-auto bg-background p-3 font-mono text-[11.5px] leading-[1.55]">
        <code>{raw ? task.source : highlight(task.source)}</code>
      </pre>
    </div>
  );
}
