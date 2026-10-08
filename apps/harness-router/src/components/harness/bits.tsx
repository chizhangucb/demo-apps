"use client";

import { cn } from "@/lib/utils";
import type { ResponseStatus } from "@/lib/uhp/types";

export const ACCENTS: Record<string, { dot: string; ring: string; text: string; soft: string }> = {
  emerald: { dot: "bg-emerald-500", ring: "ring-emerald-500/40", text: "text-emerald-700 dark:text-emerald-400", soft: "bg-emerald-500/10" },
  orange: { dot: "bg-orange-500", ring: "ring-orange-500/40", text: "text-orange-700 dark:text-orange-400", soft: "bg-orange-500/10" },
  violet: { dot: "bg-violet-500", ring: "ring-violet-500/40", text: "text-violet-700 dark:text-violet-400", soft: "bg-violet-500/10" },
  sky: { dot: "bg-sky-500", ring: "ring-sky-500/40", text: "text-sky-700 dark:text-sky-400", soft: "bg-sky-500/10" },
};

const STATUS_CLASS: Record<string, string> = {
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  incomplete: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  cancelled: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300",
  failed: "bg-red-500/15 text-red-700 dark:text-red-300",
  error: "bg-red-500/15 text-red-700 dark:text-red-300",
  waiting: "bg-muted text-muted-foreground",
};

export function StatusPill({ status }: { status: ResponseStatus | "error" | "waiting" }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium", STATUS_CLASS[status])}>
      {status === "in_progress" && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {status}
    </span>
  );
}

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded border px-1.5 py-px font-mono text-[10.5px] text-muted-foreground", className)}>{children}</span>;
}

export function shortId(id: string, keep = 10): string {
  return id.length > keep + 8 ? `${id.slice(0, keep)}…${id.slice(-4)}` : id;
}
