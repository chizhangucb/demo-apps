"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Fact } from "@/lib/types";

export function stamp(asOf: string | null) {
  if (!asOf) return "";
  return asOf.length > 10 ? `${asOf.slice(0, 10)} ${asOf.slice(11, 16)}Z` : asOf;
}

/** Literal "not obtained" marker. The tooltip says why. */
export function NotObtained({ note }: { note?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        className="num inline-flex cursor-help items-center border border-dashed border-down/60 px-1 text-[10px] uppercase tracking-wide text-down"
      >
        not obtained
      </TooltipTrigger>
      <TooltipContent className="max-w-xs bg-popover text-popover-foreground">{note ?? "No sourced value was gathered."}</TooltipContent>
    </Tooltip>
  );
}

/** Source chip + timestamp for any figure that has a value; "not obtained" otherwise. */
export function SourceTag({ fact, compact = false }: { fact: Fact; compact?: boolean }) {
  if (fact.value === null) return <NotObtained note={fact.note} />;
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        className={`num inline-flex max-w-full cursor-help border border-border bg-muted/60 px-1 text-[10px] leading-4 text-muted-foreground ${
          compact ? "flex-col items-start" : "items-center gap-1 whitespace-nowrap"
        }`}
      >
        <span className="text-cyan">{fact.source}</span>
        <span className="opacity-70">{stamp(fact.asOf)}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm bg-popover text-popover-foreground">
        <div className="space-y-0.5 text-[11px]">
          <div>{fact.source}</div>
          <div className="num opacity-80">as of {fact.asOf}</div>
          {fact.detail && <div className="opacity-80">{fact.detail}</div>}
          {fact.note && <div className="opacity-80">{fact.note}</div>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/** A value with its source tag, or "not obtained". */
export function Fig({ fact, format, className }: { fact: Fact; format: (v: number) => string; className?: string }) {
  if (fact.value === null) return <NotObtained note={fact.note} />;
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className ?? ""}`}>
      <span className="num text-foreground">{format(fact.value)}</span>
      <SourceTag fact={fact} />
    </span>
  );
}

export const fmt = {
  money: (m: number) => (Math.abs(m) >= 1000 ? `$${(m / 1000).toFixed(2)}B` : `$${m.toFixed(0)}m`),
  usd: (x: number) => `$${x.toFixed(2)}`,
  pct: (x: number) => `${(x * 100).toFixed(1)}%`,
  x: (x: number) => `${x.toFixed(2)}x`,
  shares: (m: number) => `${m.toFixed(0)}m`,
};
