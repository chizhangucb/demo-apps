"use client";

import { NOT_OBTAINED, type GapRow } from "@/lib/report";
import { NotObtained, SourceTag } from "./source-tag";

function Cell({ text, fact }: { text: string; fact: GapRow["pricedInFact"] }) {
  if (text === NOT_OBTAINED || fact.value === null) return <NotObtained note={fact.note} />;
  return (
    <div className="min-w-0 space-y-0.5">
      <div className="num text-[13px] leading-tight text-foreground">{text}</div>
      <SourceTag fact={fact} compact />
    </div>
  );
}

export function GapTable({ rows }: { rows: GapRow[] }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-1.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber">Priced in vs our view</h2>
      </div>
      <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-2 border-b border-border px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Driver</span>
        <span>Priced in</span>
        <span>Our view</span>
      </div>
      <div data-testid="gap-table">
        {rows.map((r) => (
          <div key={r.id} className="border-b border-border/60 px-3 py-1.5">
            <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] items-start gap-x-2">
              <div className="text-[11px] font-medium leading-tight text-foreground">{r.label}</div>
              <Cell text={r.pricedIn} fact={r.pricedInFact} />
              <Cell text={r.ourView} fact={r.ourViewFact} />
            </div>
            <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
              <span className="text-amber/80">Falsifier:</span> {r.falsifier}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
