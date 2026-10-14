import { ACCOUNTS } from "../../../data/scenario";
import type { Account } from "@/lib/routing/types";
import { cn } from "@/lib/utils";

export const ACC: Record<string, Account> = Object.fromEntries(ACCOUNTS.map((a) => [a.id, a]));

export const fmtTok = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${Math.round(n)}`;
export const fmtUsd = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`;

export function Dot({ id, className }: { id: string; className?: string }) {
  return <span className={cn("inline-block size-2.5 shrink-0 rounded-full", className)} style={{ background: ACC[id]?.color ?? "#999" }} />;
}

export function AccountPill({ id, dim, strike }: { id: string; dim?: boolean; strike?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] leading-none whitespace-nowrap",
        dim && "opacity-45",
        strike && "line-through",
      )}
    >
      <Dot id={id} className="size-2" />
      {ACC[id]?.label ?? id}
    </span>
  );
}

export function Bar({ value, color, label }: { value: number | null; color?: string; label: string }) {
  if (value === null) return <div className="text-[11px] text-muted-foreground">{label}: no window</div>;
  const v = Math.min(100, Math.max(0, value));
  const tone = v >= 98 ? "#dc2626" : v >= 90 ? "#d97706" : (color ?? "#525252");
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-9 shrink-0 text-muted-foreground">{label}</span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${v}%`, background: tone }} />
        <div className="absolute inset-y-0 left-[90%] w-px bg-amber-500/70" />
        <div className="absolute inset-y-0 left-[98%] w-px bg-red-500/70" />
      </div>
      <span className="w-9 shrink-0 text-right tabular-nums">{v.toFixed(0)}%</span>
    </div>
  );
}

export function Illustrative({ className }: { className?: string }) {
  return (
    <span className={cn("rounded border border-dashed px-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase", className)}>
      illustrative
    </span>
  );
}
