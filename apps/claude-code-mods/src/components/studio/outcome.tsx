import { ArrowRight, Ban, CircleAlert, MessageSquareReply, PencilLine, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FireResult, ModEvent, Outcome, TraceStep } from "@/lib/types";

export const OUTCOME_STYLE: Record<Outcome, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  deny: { label: "Deny", className: "bg-red-500/15 text-red-700 ring-red-500/30 dark:text-red-300", icon: Ban },
  rewrite: { label: "Rewrite", className: "bg-amber-500/15 text-amber-800 ring-amber-500/30 dark:text-amber-300", icon: PencilLine },
  "pass-through": {
    label: "Pass-through",
    className: "bg-emerald-500/15 text-emerald-800 ring-emerald-500/30 dark:text-emerald-300",
    icon: ArrowRight,
  },
  answer: { label: "Answered", className: "bg-sky-500/15 text-sky-800 ring-sky-500/30 dark:text-sky-300", icon: MessageSquareReply },
  error: { label: "Error", className: "bg-zinc-500/15 text-zinc-700 ring-zinc-500/30 dark:text-zinc-300", icon: CircleAlert },
};

export function OutcomePill({ outcome, size = "sm" }: { outcome: Outcome; size?: "sm" | "lg" }) {
  const s = OUTCOME_STYLE[outcome];
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium ring-1 ring-inset",
        size === "lg" ? "px-3 py-1 text-base" : "px-2 py-0.5 text-xs",
        s.className,
      )}
    >
      <Icon className={size === "lg" ? "size-4" : "size-3"} />
      {s.label}
    </span>
  );
}

const strip = (e?: ModEvent) => {
  if (!e) return undefined;
  const { name: _n, ...rest } = e;
  void _n;
  return rest;
};

function Json({ value, highlight }: { value: unknown; highlight?: boolean }) {
  return (
    <pre
      className={cn(
        "max-h-48 overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all",
        highlight && "border-amber-500/50 bg-amber-500/5",
      )}
    >
      {value === undefined ? "—" : typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}

/** What the user would see in Claude Code, for the events where that's easy to picture. */
function Preview({ r }: { r: FireResult }) {
  const name = r.original.name;
  const res = r.result as Record<string, unknown> | string | undefined;
  if (name === "ui.render" && res && typeof res === "object" && res.props) {
    const p = res.props as Record<string, string>;
    return (
      <div className="rounded-md bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100">
        <span className="text-orange-400">✻</span> {p.verb}
        <span className="text-zinc-400">{p.suffix}</span>
      </div>
    );
  }
  if (name === "tool.call") {
    const cmd = (r.delivered?.command ?? r.original.command) as string | undefined;
    const tool = r.original.tool as string;
    const out =
      res && typeof res === "object" ? ((res.deny as string) ?? (res.result as string) ?? JSON.stringify(res)) : String(res ?? "");
    return (
      <div className="space-y-1 rounded-md bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100">
        <div>
          <span className="text-emerald-400">●</span> {tool}
          {cmd ? `(${cmd})` : `(${String(r.original.file_path ?? "")})`}
        </div>
        <div className={cn("whitespace-pre-wrap pl-3", r.outcome === "deny" ? "text-red-300" : "text-zinc-400")}>⎿ {out}</div>
      </div>
    );
  }
  if (name === "prompt.submit" && res && typeof res === "object") {
    const ctx = (res.context as string[] | undefined) ?? [];
    return (
      <div className="space-y-1 rounded-md bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100">
        <div>
          <span className="text-zinc-500">&gt;</span> {String(res.sent ?? res.drop ?? "")}
        </div>
        {ctx.map((c) => (
          <div key={c} className="pl-3 text-sky-300">
            + context for Claude: {c}
          </div>
        ))}
      </div>
    );
  }
  if (name === "tool.check") {
    const decision = typeof res === "string" ? res : (res as Record<string, unknown> | undefined)?.decision;
    const reason = typeof res === "object" ? (res as Record<string, unknown>).reason : undefined;
    return (
      <div className="rounded-md bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100">
        permission: <span className={decision === "deny" ? "text-red-300" : "text-emerald-300"}>{String(decision)}</span>
        {reason ? <span className="text-zinc-400"> — {String(reason)}</span> : null}
      </div>
    );
  }
  return null;
}

const STEP_DOT: Record<TraceStep["kind"], string> = {
  fire: "bg-foreground",
  hook: "bg-violet-500",
  api: "bg-sky-500",
  next: "bg-amber-500",
  engine: "bg-emerald-500",
  return: "bg-muted-foreground",
  skip: "bg-zinc-400",
  error: "bg-red-500",
};

export function OutcomeView({ r, expected }: { r: FireResult; expected?: Outcome }) {
  const rewritten = r.delivered && JSON.stringify(strip(r.delivered)) !== JSON.stringify(strip(r.original));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <OutcomePill outcome={r.outcome} size="lg" />
        <span className="text-sm text-muted-foreground">
          {r.matchedHooks} hook{r.matchedHooks === 1 ? "" : "s"} matched · {r.ms}ms
        </span>
        {expected && (
          <span
            className={cn(
              "ml-auto rounded-md px-2 py-0.5 text-xs",
              expected === r.outcome ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700",
            )}
          >
            fixture expects {expected} {expected === r.outcome ? "✓" : "✗"}
          </span>
        )}
      </div>
      <p className="text-sm">{r.reason}</p>
      <Preview r={r} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Event in · {r.original.name}</div>
          <Json value={strip(r.original)} />
        </div>
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Reached Claude Code {rewritten ? "(rewritten)" : ""}</div>
          <Json value={r.delivered ? strip(r.delivered) : "— never reached: the mod answered"} highlight={Boolean(rewritten)} />
        </div>
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Result returned</div>
          <Json value={r.result} highlight={r.outcome === "deny"} />
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Workflow className="size-3.5" /> Middleware trace
        </div>
        <ol className="space-y-1.5">
          {r.trace.map((s, i) => (
            <li key={i} className="flex gap-2 text-xs">
              <span className={cn("mt-1 size-2 shrink-0 rounded-full", STEP_DOT[s.kind])} />
              <span>
                <span className="font-medium">{s.label}</span>
                {s.detail && <span className="block font-mono text-[11px] break-all text-muted-foreground">{s.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
