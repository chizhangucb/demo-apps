import type { ReactNode } from "react";
import { cn } from "cn";
import { SOURCES, type SourceKey } from "../../../data/benchmarks";

// Small citation chip. Every published number on screen sits next to one.
export function Src({ k, href, label, className }: { k?: SourceKey; href?: string; label?: string; className?: string }) {
  const s = k ? SOURCES[k] : null;
  const url = href ?? s?.url ?? "#";
  const text = label ?? s?.label ?? "source";
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title={url}
      className={cn(
        "inline-flex items-center gap-0.5 align-middle font-mono text-[10px] leading-none text-cyan-glow/70 underline decoration-cyan-glow/30 underline-offset-2 hover:text-cyan-glow",
        className,
      )}
    >
      [{text}]
    </a>
  );
}

export function Panel({
  channel,
  title,
  tag,
  right,
  children,
  className,
}: {
  channel: string;
  title: string;
  tag?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("panel flex flex-col", className)}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/80 px-4 py-2.5">
        <span className="font-mono text-[10px] tracking-[0.2em] text-cyan-glow/80">{channel}</span>
        <h2 className="font-mono text-xs font-semibold tracking-[0.14em] text-foreground uppercase">{title}</h2>
        {tag}
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </header>
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}

export function SimTag({ children = "SIMULATION" }: { children?: ReactNode }) {
  return (
    <span className="glow-sim border border-sim/60 bg-sim/10 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.2em] text-sim">
      {children}
    </span>
  );
}

export function SampleTag({ children = "SAMPLE" }: { children?: ReactNode }) {
  return (
    <span className="glow-amber border border-amber-glow/60 bg-amber-glow/10 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.2em] text-amber-glow">
      {children}
    </span>
  );
}

export function LiveTag({ children }: { children: ReactNode }) {
  return (
    <span className="glow-cyan border border-pass/60 bg-pass/10 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.2em] text-pass">
      {children}
    </span>
  );
}

export function Readout({
  label,
  value,
  unit,
  note,
  accent = "cyan",
}: {
  label: string;
  value: string;
  unit?: string;
  note?: ReactNode;
  accent?: "cyan" | "amber" | "sim";
}) {
  const color = accent === "amber" ? "text-amber-glow glow-amber" : accent === "sim" ? "text-sim glow-sim" : "text-cyan-glow glow-cyan";
  return (
    <div className="border border-border/80 bg-black/30 px-3 py-2">
      <div className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={cn("font-mono text-2xl font-semibold tabular-nums", color)}>{value}</span>
        {unit && <span className="font-mono text-[11px] text-muted-foreground">{unit}</span>}
      </div>
      {note && <div className="mt-1 font-mono text-[10px] text-muted-foreground">{note}</div>}
    </div>
  );
}

export function fmt(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "--";
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
