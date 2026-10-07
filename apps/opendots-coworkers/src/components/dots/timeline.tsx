"use client";

import { Ban, CheckCircle2, Flag, Info, Wrench, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { groupByLane, type Lane, type RunView, type TimelineItem } from "@/lib/run-view";
import { cn } from "@/lib/utils";

const LANE_STYLE: Record<Lane, { name: string; dot: string; border: string }> = {
  researcher: { name: "Researcher", dot: "bg-sky-500", border: "border-sky-500/40" },
  writer: { name: "Writer", dot: "bg-violet-500", border: "border-violet-500/40" },
  run: { name: "Run", dot: "bg-muted-foreground", border: "border-border" },
};

export function Timeline({ view }: { view: RunView }) {
  const groups = groupByLane(view.items);
  if (!groups.length)
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Pick a task and press Run. AG-UI events from <code>POST /api/agent</code> stream in here, grouped by Dot.
      </p>
    );
  return (
    <div className="space-y-3" data-testid="timeline">
      {groups.map((g, i) => {
        const s = LANE_STYLE[g.lane];
        return (
          <section key={i} className={cn("rounded-lg border-l-4 bg-card/60 p-3 ring-1 ring-foreground/5", s.border)}>
            <header className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span className={cn("size-2 rounded-full", s.dot)} />
              {s.name}
            </header>
            <ol className="space-y-1.5">
              {g.items.map((it) => (
                <Item key={it.key} it={it} view={view} />
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function Item({ it, view }: { it: TimelineItem; view: RunView }) {
  switch (it.kind) {
    case "subagent":
      return (
        <li className="text-xs text-muted-foreground">
          {it.done ? "✓ subagent finished" : `▶ ${it.label}`}
        </li>
      );
    case "step":
      return (
        <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Flag className="size-3" /> step: <span className="font-mono">{it.label}</span>
        </li>
      );
    case "text":
      return <li className="text-sm whitespace-pre-wrap">{view.texts[it.messageId]}</li>;
    case "tool": {
      const t = view.tools[it.toolCallId];
      if (!t) return null;
      const pending = t.result === undefined;
      return (
        <li
          className={cn(
            "rounded-md border px-2 py-1.5 font-mono text-xs",
            t.denied ? "border-destructive/50 bg-destructive/5" : "bg-muted/40",
          )}
        >
          <div className="flex items-center gap-1.5">
            <Wrench className="size-3 shrink-0" />
            <span className="font-semibold">{t.name}</span>
            <span className="truncate text-muted-foreground">{t.args}</span>
            <span className="ml-auto shrink-0">
              {pending ? (
                <Badge variant="outline">running</Badge>
              ) : t.denied ? (
                <Badge variant="destructive">denied</Badge>
              ) : (
                <Badge variant="secondary">ok</Badge>
              )}
            </span>
          </div>
          {!pending && !t.denied && (
            <div className="mt-1 line-clamp-2 whitespace-pre-wrap text-muted-foreground">↳ {t.result}</div>
          )}
        </li>
      );
    }
    case "denied":
      return (
        <li
          className="flex items-start gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 text-xs font-medium text-destructive"
          data-testid="denial"
        >
          <Ban className="mt-0.5 size-3.5 shrink-0" /> Permission denied: {it.label}
        </li>
      );
    case "note": {
      const Icon = it.tone === "error" ? XCircle : it.tone === "ok" ? CheckCircle2 : Info;
      return (
        <li className="flex items-center gap-1.5 text-xs font-medium">
          <Icon className="size-3.5" /> {it.label}
        </li>
      );
    }
  }
}

export function RawEvents({ view }: { view: RunView }) {
  return (
    <ol className="space-y-1 font-mono text-[11px]" data-testid="raw-events">
      {view.events.map((ev, i) => {
        const { type, ...rest } = ev;
        return (
          <li key={i} className="rounded border bg-muted/30 px-2 py-1">
            <span
              className={cn(
                "font-semibold",
                type === "CUSTOM" && (ev as { name?: string }).name === "permission_denied" && "text-destructive",
              )}
            >
              {type}
            </span>{" "}
            <span className="break-all text-muted-foreground">{JSON.stringify(rest)}</span>
          </li>
        );
      })}
    </ol>
  );
}
