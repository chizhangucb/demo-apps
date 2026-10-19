"use client";

import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { decide, footballField, gapTable } from "@/lib/report";
import type { ResearchRun } from "@/lib/types";
import { AssumptionsPanel } from "./assumptions-panel";
import { Chapters } from "./chapters";
import { FootballField } from "./football-field";
import { GapTable } from "./gap-table";
import { GradePanel } from "./grade-panel";
import { Fig, fmt, stamp } from "./source-tag";

const STEPS = ["Resolve CIK (SEC ticker list)", "Fetch EDGAR companyfacts and submissions", "Grade earnings quality", "Claude sets assumptions", "Run dcf.py", "Claude writes the nine chapters"];

export function Desk({ initial, liveEnabled }: { initial: ResearchRun; liveEnabled: boolean }) {
  const [run, setRun] = useState(initial);
  const [ticker, setTicker] = useState(initial.company.ticker);
  const [loading, setLoading] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const field = useMemo(() => footballField(run), [run]);
  const gap = useMemo(() => gapTable(run), [run]);
  const decision = useMemo(() => decide(run), [run]);
  const sample = run.mode === "sample";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/research", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ticker }) });
      const next = (await res.json()) as ResearchRun;
      setRun(next);
      setTicker(next.company.ticker);
      setRunKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="scanlines min-h-screen">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-panel px-4 py-2">
        <div className="flex items-baseline gap-2">
          <span className="num text-sm font-bold tracking-[0.25em] text-amber">EQUITY RESEARCH DESK</span>
          <span className="hidden text-[10px] text-muted-foreground md:inline">nine-chapter single-stock research, equity-research-skill</span>
        </div>
        <form onSubmit={submit} className="flex items-center gap-0">
          <label htmlFor="ticker" className="sr-only">
            US ticker
          </label>
          <span className="num border border-r-0 border-input bg-muted px-2 py-1 text-[11px] text-muted-foreground">US</span>
          <input
            id="ticker"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            maxLength={10}
            className="num w-24 border border-input bg-background px-2 py-1 text-sm font-semibold tracking-widest text-foreground outline-none focus:border-amber"
            placeholder="TICKER"
            autoComplete="off"
          />
          <button type="submit" disabled={loading} className="inline-flex items-center gap-1 border border-amber bg-amber px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-black disabled:opacity-60">
            {loading ? <Loader2 className="size-3 animate-spin" /> : <Search className="size-3" />} Run
          </button>
        </form>
        <span
          data-testid="mode-badge"
          className={`num border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${sample ? "border-amber text-amber" : "border-up text-up"}`}
        >
          {sample ? "SAMPLE (cached EDGAR)" : "LIVE"}
        </span>
        {!liveEnabled && <span className="text-[10px] text-muted-foreground">No API key on server: runs load the SAMPLE.</span>}
        <span className="ml-auto border border-down/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-down">Not investment advice</span>
      </header>

      {run.notice && <div className="border-b border-amber/40 bg-amber/10 px-4 py-1.5 text-[11px] text-amber">{run.notice}</div>}
      {loading && (
        <div className="border-b border-border bg-panel px-4 py-1.5 text-[11px] text-muted-foreground">
          <span className="num text-amber">RUNNING </span>
          {STEPS.join("  >  ")}
        </div>
      )}

      <section className="flex flex-wrap items-end gap-x-6 gap-y-1 border-b border-border px-4 py-2">
        <div>
          <div className="num text-2xl font-bold tracking-wider text-foreground">
            {run.company.ticker} <span className="text-base font-normal text-muted-foreground">{run.company.name}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            CIK {run.company.cik} | {run.company.exchange ?? "exchange not obtained"} | data cutoff FY{run.fundamentals.fiscalYears.at(-1)?.slice(0, 4)} 10-K, retrieved{" "}
            <span className="num">{stamp(run.fundamentals.retrievedAt)}</span> | report {stamp(run.generatedAt)}
          </div>
        </div>
        <div className="text-[11px]">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Last price</div>
          <Fig fact={run.quote.price} format={fmt.usd} className="text-lg" />
        </div>
        <div className="text-[11px]">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Revenue, latest FY</div>
          <Fig fact={run.fundamentals.metrics.revenue.at(-1)!} format={fmt.money} />
        </div>
        <div className="text-[11px]">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Final action</div>
          <span className={`num text-lg font-bold ${decision.finalAction === "Avoid" ? "text-down" : "text-amber"}`}>{decision.finalAction.toUpperCase()}</span>
        </div>
        <div className="ml-auto text-right text-[10px] text-muted-foreground">
          Prose: {run.narrativeSource}
          <br />
          Valuation: dcf.py via {run.valuation.runner}
        </div>
      </section>

      <main key={runKey}>
        <div className="grid border-b border-border xl:grid-cols-[minmax(300px,0.78fr)_minmax(0,1.5fr)_minmax(400px,1.12fr)]">
          <div className="border-b border-border xl:border-r xl:border-b-0">
            <GradePanel quality={run.quality} decision={decision} retrievedAt={run.fundamentals.retrievedAt} />
          </div>
          <div className="border-b border-border xl:border-r xl:border-b-0">
            <FootballField rows={field} price={run.quote.price.value} priceFact={run.quote.price} />
          </div>
          <div>
            <GapTable rows={gap} />
          </div>
        </div>

        <div className="border-b border-border">
          <Chapters run={run} gap={gap} />
        </div>

        <details className="border-b border-border" open>
          <summary className="cursor-pointer bg-panel px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber">
            Assumptions and dcf.py provenance
          </summary>
          <AssumptionsPanel run={run} onRevalue={(assumptions, valuation) => setRun((r) => ({ ...r, assumptions, valuation }))} />
        </details>
      </main>

      <footer className="space-y-1 px-4 py-4 text-[10px] text-muted-foreground">
        <p>
          Not investment advice. This is a demo of a research workflow; the action shown is a rule output, not a recommendation. It never places trades. Figures carry their source and
          timestamp; anything without a source shows &quot;not obtained&quot;.
        </p>
        <p>
          Method and dcf.py from{" "}
          <a className="underline hover:text-foreground" href="https://github.com/rollingSirius/equity-research-skill">
            rollingSirius/equity-research-skill
          </a>{" "}
          (MIT). Data: SEC EDGAR public APIs; price from the Yahoo Finance chart endpoint.
        </p>
      </footer>
    </div>
  );
}
