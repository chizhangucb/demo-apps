import { GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODEL_NAMES, type ModelAlias } from "@/lib/workflow/types";

const MODEL_STYLE: Record<ModelAlias, string> = {
  haiku: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  sonnet: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  opus: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
};

export function ModelBadge({ model, className }: { model: ModelAlias; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center rounded-full border px-2 font-mono text-[11px] font-medium", MODEL_STYLE[model], className)}>
      {MODEL_NAMES[model]}
    </span>
  );
}

export function WorktreeBadge() {
  return (
    <span
      title="Runs in its own worktree (illustrative: { isolation: 'worktree' }; no real git worktree is created)"
      className="inline-flex h-5 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 font-mono text-[11px] text-amber-700 dark:text-amber-300"
    >
      <GitBranch className="size-3" />
      worktree
    </span>
  );
}

export function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(Math.round(n));
}

const TOKEN_RE =
  /(\/\/[^\n]*)|(`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")|\b(export|const|let|await|async|return|while|for|if|new|of)\b|\b(agent|parallel|pipeline|phase|log|args|meta)\b|\b(model|label|schema|isolation)(?=\s*:)|\b(\d+)\b/g;

/** A tiny JS highlighter tuned for workflow scripts: primitives and per-agent options stand out. */
export function highlight(src: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of src.matchAll(TOKEN_RE)) {
    if (m.index > last) out.push(src.slice(last, m.index));
    const cls = m[1]
      ? "text-muted-foreground italic"
      : m[2]
        ? "text-emerald-700 dark:text-emerald-400"
        : m[3]
          ? "text-rose-600 dark:text-rose-400"
          : m[4]
            ? "font-semibold text-violet-700 dark:text-violet-300"
            : m[5]
              ? "text-sky-700 dark:text-sky-300"
              : "text-amber-700 dark:text-amber-300";
    out.push(
      <span key={k++} className={cls}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  out.push(src.slice(last));
  return out;
}
