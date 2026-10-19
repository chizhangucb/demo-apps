"use client";

import { Ban, ShieldAlert } from "lucide-react";
import type { Action, Decision } from "@/lib/report";
import type { QualityResult } from "@/lib/types";
import { NotObtained, SourceTag } from "./source-tag";

const GRADE_STYLE: Record<string, string> = {
  A: "border-up text-up",
  B: "border-cyan text-cyan",
  C: "border-amber text-amber",
  D: "border-down text-down",
};

const ACTIONS: Action[] = ["Buy", "Hold", "Wait and see", "Avoid"];

export function GradePanel({ quality, decision, retrievedAt }: { quality: QualityResult; decision: Decision; retrievedAt: string }) {
  const fails = quality.checks.filter((c) => c.status === "fail");
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-1.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber">Earnings quality and action</h2>
      </div>
      <div className="flex items-start gap-3 px-3 pt-3">
        <div
          data-testid="grade-badge"
          className={`num flex size-20 shrink-0 flex-col items-center justify-center border-2 ${GRADE_STYLE[quality.grade]}`}
          aria-label={`Earnings quality grade ${quality.grade}`}
        >
          <span className="text-5xl font-bold leading-none">{quality.grade}</span>
          <span className="mt-1 text-[9px] uppercase tracking-widest">grade</span>
        </div>
        <div className="min-w-0 space-y-1 text-[11px]">
          <p className="text-foreground">{quality.summary}</p>
          <ul className="space-y-0.5 text-muted-foreground">
            {fails.slice(0, 4).map((c) => (
              <li key={c.id} className="flex gap-1">
                <span className="text-down">FAIL</span>
                <span className="truncate">{c.label.split(",")[0]}</span>
                <span className="num ml-auto text-foreground">{c.display}</span>
              </li>
            ))}
          </ul>
          <SourceTag compact fact={{ value: 1, source: "Forensic rules on SEC 10-K", asOf: retrievedAt, detail: "See chapter 5 for every check and threshold" }} />
        </div>
      </div>

      <dl className="mx-3 mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-border pt-2 text-[11px]">
        <dt className="text-muted-foreground">Intrinsic value</dt>
        <dd className="text-foreground">{decision.intrinsic}</dd>
        <dt className="text-muted-foreground">Next 1 to 3 months</dt>
        <dd>{decision.nearTerm === "not obtained" ? <NotObtained note="No sourced price momentum, flow or event data was gathered." /> : decision.nearTerm}</dd>
        <dt className="text-muted-foreground">Model action</dt>
        <dd className="text-foreground">{decision.modelAction}</dd>
      </dl>

      <div className="mx-3 mt-2 grid grid-cols-4 gap-1">
        {ACTIONS.map((a) => {
          const blocked = a === "Buy" && decision.vetoed;
          const active = a === decision.finalAction;
          return (
            <button
              key={a}
              type="button"
              disabled={blocked}
              aria-disabled={blocked}
              data-testid={a === "Buy" ? "buy-button" : undefined}
              title={blocked ? decision.vetoReason ?? "Blocked" : a}
              className={`relative flex items-center justify-center gap-1 border px-1 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${
                blocked
                  ? "cursor-not-allowed border-down/60 bg-down/10 text-down line-through"
                  : active
                    ? "border-amber bg-amber text-black"
                    : "border-border text-muted-foreground"
              }`}
            >
              {blocked && <Ban className="size-3" />}
              {a}
            </button>
          );
        })}
      </div>
      {decision.vetoReason && (
        <div className="mx-3 mt-2 flex gap-2 border border-down/50 bg-down/10 p-2 text-[11px] text-down" role="alert">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <div>
            <div className="font-semibold uppercase tracking-wide">Buy vetoed</div>
            <div className="text-foreground/90">{decision.vetoReason}</div>
          </div>
        </div>
      )}
    </div>
  );
}
