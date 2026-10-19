"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { METRIC_LABELS } from "@/lib/edgar";
import { decide, positionSizing, type GapRow } from "@/lib/report";
import type { Fact, MetricKey, ResearchRun } from "@/lib/types";
import { Fig, fmt, NotObtained, SourceTag } from "./source-tag";

const SHORT = ["Summary", "Business", "Competition", "Governance", "Financials", "Valuation", "Analysts", "Catalysts", "Conclusion"];

export const CHAPTERS = [
  "Executive Summary",
  "Business Overview",
  "Business and Competitive Analysis",
  "Management, Governance, and Capital Allocation",
  "Financial Analysis and Earnings Quality",
  "Valuation",
  "Analyst View Summary",
  "Recent News and Catalysts",
  "Investment Conclusion, Counter-Case, and Position Sizing",
];

const missing = (note: string): Fact => ({ value: null, source: null, asOf: null, note });

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 border-b border-border/50 py-1 text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function Prose({ run, n }: { run: ResearchRun; n: number }) {
  const ch = run.narrative.chapters[String(n)];
  if (!ch) return null;
  return (
    <div className="space-y-2 text-[13px] leading-relaxed text-foreground/90">
      {ch.paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      <div className="border-l-2 border-amber bg-amber/5 px-3 py-1.5 text-[12px]">
        <span className="font-semibold uppercase tracking-wide text-amber">My view </span>
        {ch.my_view}
      </div>
    </div>
  );
}

function Section({ run, n, figures }: { run: ResearchRun; n: number; figures?: ReactNode }) {
  const wide = n === 5 || n === 6;
  return (
    <div className={`grid gap-5 ${wide ? "lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.6fr)]" : "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"}`}>
      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {n}. {CHAPTERS[n - 1]}
        </h3>
        <Prose run={run} n={n} />
      </div>
      <div>{figures}</div>
    </div>
  );
}

function margin(run: ResearchRun, num: MetricKey, i: number): Fact {
  const f = run.fundamentals;
  const a = f.metrics[num][i], b = f.metrics.revenue[i];
  if (a.value === null || !b.value) return missing(`${METRIC_LABELS[num]} or revenue not obtained`);
  return { value: a.value / b.value, source: `Derived: ${a.source}`, asOf: a.asOf, detail: `${METRIC_LABELS[num]} / revenue` };
}

function FundamentalsTable({ run }: { run: ResearchRun }) {
  const f = run.fundamentals;
  const keys = Object.keys(METRIC_LABELS) as MetricKey[];
  return (
    <div className="overflow-x-auto">
      <table className="num w-full min-w-[520px] text-right text-[11px]">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="py-1 text-left font-medium">$m</th>
            {f.fiscalYears.map((y, i) => (
              <th key={y} className="px-1 py-1 align-bottom font-medium">
                <div className="text-foreground">FY{y.slice(0, 4)}</div>
                <SourceTag compact fact={f.metrics.revenue[i]} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k} className="border-b border-border/40">
              <td className="py-0.5 text-left font-sans text-muted-foreground">{METRIC_LABELS[k]}</td>
              {f.metrics[k].map((x, i) => (
                <td key={i} className="px-1 py-0.5" title={x.detail ?? x.note}>
                  {x.value === null ? <NotObtained note={x.note} /> : x.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-muted-foreground">Column tags show the 10-K and period end; hover a cell for the XBRL concept and accession.</p>
    </div>
  );
}

function ValuationTables({ run }: { run: ResearchRun }) {
  const v = run.valuation;
  const tag: Fact = { value: 1, source: "dcf.py", asOf: v.ranAt, detail: `${v.engine}; ${v.runner}` };
  return (
    <div className="space-y-4 text-[12px]">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        Every number below <SourceTag fact={tag} />
      </div>
      <table className="num w-full text-right text-[11px]">
        <thead className="text-muted-foreground">
          <tr className="border-b border-border">
            <th className="py-1 text-left font-medium">Method</th>
            <th className="font-medium">Low</th>
            <th className="font-medium">Point</th>
            <th className="font-medium">High</th>
          </tr>
        </thead>
        <tbody>
          {v.ranges.map((r) => (
            <tr key={r.id} className="border-b border-border/40">
              <td className="py-0.5 text-left font-sans">{r.method}</td>
              <td>{fmt.usd(r.low)}</td>
              <td className="text-foreground">{fmt.usd(r.mid)}</td>
              <td>{fmt.usd(r.high)}</td>
            </tr>
          ))}
          <tr className="border-b border-border/40">
            <td className="py-0.5 text-left font-sans">Relative, peer multiples</td>
            <td colSpan={3}>
              <NotObtained note="No sourced peer multiple set was gathered for this run" />
            </td>
          </tr>
        </tbody>
      </table>
      {v.scenarios && (
        <table className="num w-full text-right text-[11px]">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-1 text-left font-medium">Scenario</th>
              <th className="font-medium">Prob</th>
              <th className="font-medium">$/share</th>
              <th className="font-medium">TV share</th>
              <th className="font-medium">Exit P/FCF</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(v.scenarios).map(([k, s]) => (
              <tr key={k} className="border-b border-border/40">
                <td className="py-0.5 text-left font-sans capitalize">{k}</td>
                <td>{fmt.pct(s.prob)}</td>
                <td className="text-foreground">{fmt.usd(s.per_share)}</td>
                <td className={s.tv_warning ? "text-down" : ""}>
                  {fmt.pct(s.tv_share)}
                  {s.tv_warning ? " TV>80%" : ""}
                </td>
                <td>{s.exit_pfcf.toFixed(1)}x</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {v.sensitivity && (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">WACC x g sensitivity ({v.sensitivity.scenario}), $/share</div>
          <table className="num text-right text-[11px]">
            <thead className="text-muted-foreground">
              <tr>
                <th className="pr-3" />
                {v.sensitivity.g.map((g) => (
                  <th key={g} className="px-2 font-medium">
                    g {fmt.pct(g)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {v.sensitivity.grid.map((row, i) => (
                <tr key={i}>
                  <td className="pr-3 text-muted-foreground">WACC {fmt.pct(v.sensitivity!.wacc[i])}</td>
                  {row.map((c, j) => (
                    <td key={j} className="px-2">
                      {c.toFixed(1)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="grid gap-x-6 sm:grid-cols-2">
        {v.reverse && (
          <>
            <Row label="Reverse DCF: FCF the price needs">{fmt.money(v.reverse.fcf_required)} / yr</Row>
            {v.reverse.rows.map((r) => (
              <Row key={r.margin} label={`Implied revenue CAGR at ${fmt.pct(r.margin)} margin`}>
                <span className="num">{r.implied_cagr === null ? "n/a" : fmt.pct(r.implied_cagr)}</span>
              </Row>
            ))}
          </>
        )}
        {v.pvgo && <Row label="PVGO share of price">{fmt.pct(v.pvgo.pvgo_pct)}</Row>}
        {v.epv && <Row label="EPV per share">{fmt.usd(v.epv.epv_ps)}</Row>}
        {v.eva && <Row label="EVA per share">{fmt.usd(v.eva.per_share)}</Row>}
        {v.montecarlo && (
          <Row label={`Monte Carlo P(value < price), n=${v.montecarlo.n}`}>{v.montecarlo.p_loss === null ? "n/a" : fmt.pct(v.montecarlo.p_loss)}</Row>
        )}
        {v.calibrate && (
          <Row label="dcf.py calibrate label">
            {v.calibrate.label} <span className="text-muted-foreground">({v.calibrate.label_zh})</span>
          </Row>
        )}
      </div>
    </div>
  );
}

export function Chapters({ run, gap }: { run: ResearchRun; gap: GapRow[] }) {
  const f = run.fundamentals;
  const last = f.fiscalYears.length - 1;
  const d = decide(run);
  const pos = positionSizing(run);
  const v = run.valuation;
  const dcfTag: Fact = { value: 1, source: "dcf.py", asOf: v.ranAt };

  const figures: Record<number, ReactNode> = {
    1: (
      <div className="space-y-3">
        <div>
          <Row label="Price">
            <Fig fact={run.quote.price} format={fmt.usd} />
          </Row>
          <Row label="Probability weighted DCF">
            {v.weighted != null ? <Fig fact={{ ...dcfTag, value: v.weighted }} format={fmt.usd} /> : <NotObtained />}
          </Row>
          <Row label="Composite range">
            {v.composite ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="num">
                  {fmt.usd(v.composite.low)} to {fmt.usd(v.composite.high)}
                </span>
                <SourceTag fact={dcfTag} />
              </span>
            ) : (
              <NotObtained />
            )}
          </Row>
          <Row label="Action">
            <span className="font-semibold text-amber">{d.finalAction}</span>
          </Row>
        </div>
        <div className="border border-border p-2 text-[12px]">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Thesis (My view)</div>
          <p>{run.narrative.thesis || <NotObtained note="No independent view, so no buy or sell action." />}</p>
          <div className="mt-2 mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Falsifiers</div>
          <ol className="list-decimal space-y-0.5 pl-4">
            {run.narrative.falsifiers.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ol>
          <div className="mt-2 text-[10px] text-muted-foreground">Gap table rows: {gap.map((g) => g.label).join(", ")}.</div>
        </div>
      </div>
    ),
    2: (
      <div>
        <Row label="Legal name">{run.company.name}</Row>
        <Row label="SIC">
          {run.company.sic.value !== null ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="num">
                {run.company.sic.value} {run.company.sic.label}
              </span>
              <SourceTag fact={run.company.sic} />
            </span>
          ) : (
            <NotObtained note={run.company.sic.note} />
          )}
        </Row>
        <Row label="Exchange / FYE">
          {run.company.exchange ?? "not obtained"} / {run.company.fiscalYearEnd ? `${run.company.fiscalYearEnd.slice(0, 2)}-${run.company.fiscalYearEnd.slice(2)}` : "not obtained"}
        </Row>
        {f.fiscalYears.map((y, i) => (
          <Row key={y} label={`Revenue FY${y.slice(0, 4)}`}>
            <Fig fact={f.metrics.revenue[i]} format={fmt.money} />
          </Row>
        ))}
        <Row label="Gross margin, latest">
          <Fig fact={margin(run, "grossProfit", last)} format={fmt.pct} />
        </Row>
        <Row label="Operating margin, latest">
          <Fig fact={margin(run, "opIncome", last)} format={fmt.pct} />
        </Row>
      </div>
    ),
    3: (
      <div>
        <Row label="Market share">
          <NotObtained note="No sourced market share dataset in this run" />
        </Row>
        <Row label="Peer valuation multiples">
          <NotObtained note="No sourced peer multiple set was gathered for this run" />
        </Row>
        {f.fiscalYears.map((y, i) => (
          <Row key={y} label={`Gross margin FY${y.slice(0, 4)}`}>
            <Fig fact={margin(run, "grossProfit", i)} format={fmt.pct} />
          </Row>
        ))}
      </div>
    ),
    4: (
      <div>
        <Row label="Stock based comp, latest">
          <Fig fact={f.metrics.sbc[last]} format={fmt.money} />
        </Row>
        {f.fiscalYears.map((y, i) => (
          <Row key={y} label={`Diluted shares FY${y.slice(0, 4)}`}>
            <Fig fact={f.metrics.dilutedShares[i]} format={fmt.shares} />
          </Row>
        ))}
        <Row label="Shares outstanding, cover page">
          <Fig fact={f.sharesOutstanding} format={fmt.shares} />
        </Row>
        <div className="mt-3 mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Flagged filings, last 3 years</div>
        <ul className="space-y-1 text-[12px]">
          {run.company.filings.filter((e) => e.flag).length === 0 && <li className="text-muted-foreground">None flagged.</li>}
          {run.company.filings
            .filter((e) => e.flag)
            .map((e) => (
              <li key={e.accession} className="flex flex-wrap items-center gap-2">
                <span className={`num px-1 text-[10px] uppercase ${e.flag === "red" ? "bg-down/20 text-down" : "bg-amber/15 text-amber"}`}>{e.flag}</span>
                <span>{e.summary}</span>
                <SourceTag fact={{ value: 1, source: `SEC ${e.form}`, asOf: e.filed, detail: `Accession ${e.accession}; items ${e.items.join(", ") || "none"}` }} />
              </li>
            ))}
        </ul>
      </div>
    ),
    5: (
      <div className="space-y-4">
        <FundamentalsTable run={run} />
        <table className="w-full text-[11px]">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border text-left">
              <th className="py-1 font-medium">Check</th>
              <th className="font-medium">Value</th>
              <th className="font-medium">Status</th>
              <th className="font-medium">Rule</th>
            </tr>
          </thead>
          <tbody>
            {run.quality.checks.map((c) => (
              <tr key={c.id} className="border-b border-border/40 align-top">
                <td className="py-1 pr-2">{c.label}</td>
                <td className="pr-2">{c.value.value === null ? <NotObtained note={c.value.note} /> : <span className="num">{c.display}</span>}</td>
                <td className={`num pr-2 uppercase ${c.status === "fail" ? "text-down" : c.status === "warn" ? "text-amber" : "text-up"}`}>{c.status}</td>
                <td className="text-muted-foreground">{c.rule}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Row label="Beneish M-Score">
          <Fig fact={run.quality.beneish.m} format={(x) => x.toFixed(2)} />
        </Row>
        <div className="num flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
          {Object.entries(run.quality.beneish.components).map(([k, x]) => (
            <span key={k}>
              {k} {x === null ? <span className="text-down">not obtained</span> : x.toFixed(2)}
            </span>
          ))}
        </div>
      </div>
    ),
    6: <ValuationTables run={run} />,
    7: (
      <div>
        <Row label="Consensus price target">
          <NotObtained note="No licensed estimates source is wired in; the skill forbids filling it from memory." />
        </Row>
        <Row label="Rating distribution">
          <NotObtained note="No licensed estimates source is wired in." />
        </Row>
        <Row label="Consensus next-year revenue">
          <NotObtained note="No licensed estimates source is wired in." />
        </Row>
      </div>
    ),
    8: (
      <ul className="space-y-1 text-[12px]">
        {run.company.filings.slice(0, 10).map((e) => (
          <li key={e.accession} className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-1">
            <span className="num text-muted-foreground">{e.filed}</span>
            <span className="num">{e.form}</span>
            <span className="text-foreground/90">{e.summary}</span>
            <SourceTag fact={{ value: 1, source: `SEC ${e.form}`, asOf: e.filed, detail: `Accession ${e.accession}` }} />
          </li>
        ))}
      </ul>
    ),
    9: (
      <div className="space-y-3 text-[12px]">
        <Row label="Final action">
          <span className="font-semibold text-amber">{d.finalAction}</span>
        </Row>
        <Row label="Before quality veto">{d.modelAction}</Row>
        {pos && (
          <>
            <Row label="Probability weighted return">
              <span className="num">{fmt.pct(pos.ev)}</span>
            </Row>
            <Row label="Upside / downside asymmetry">
              <span className="num">{Number.isFinite(pos.asymmetry) ? pos.asymmetry.toFixed(2) : "no downside case"}</span>
            </Row>
            <Row label="Position size">{d.vetoed ? <span className="text-down">zero (vetoed)</span> : "see dcf.py position helper in transcript"}</Row>
          </>
        )}
        <div className="border border-border p-2">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Counter-case</div>
          <ul className="list-disc space-y-0.5 pl-4">
            {run.narrative.counter_case.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
          <div className="mt-2 mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Pre-mortem</div>
          <p>{run.narrative.premortem}</p>
        </div>
      </div>
    ),
  };

  return (
    <Tabs defaultValue="1" className="gap-0">
      <TabsList className="h-auto w-full flex-wrap justify-start group-data-horizontal/tabs:h-auto gap-0 rounded-none border-b border-border bg-transparent p-0">
        {CHAPTERS.map((t, i) => (
          <TabsTrigger
            key={t}
            value={String(i + 1)}
            title={t} className="h-auto flex-none rounded-none border-0 border-b-2 border-transparent px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground data-active:border-amber data-active:bg-amber/5 data-active:text-amber"
          >
            <span className="num mr-1">{i + 1}</span>
            {SHORT[i]}
          </TabsTrigger>
        ))}
        <TabsTrigger
          value="appendix"
          className="h-auto flex-none rounded-none border-0 border-b-2 border-transparent px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground data-active:border-amber data-active:text-amber"
        >
          Sources
        </TabsTrigger>
      </TabsList>
      {CHAPTERS.map((_, i) => (
        <TabsContent key={i} value={String(i + 1)} className="p-4">
          <Section run={run} n={i + 1} figures={figures[i + 1]} />
        </TabsContent>
      ))}
      <TabsContent value="appendix" className="p-4 text-[12px]">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Appendix: sources and timestamps</h3>
        <ul className="space-y-1">
          <li>
            SEC EDGAR companyfacts, CIK {f.cik}: <span className="num">data.sec.gov/api/xbrl/companyfacts/CIK{f.cik}.json</span>, retrieved <span className="num">{f.retrievedAt}</span>
          </li>
          <li>
            SEC EDGAR submissions index: <span className="num">data.sec.gov/submissions/CIK{run.company.cik}.json</span>, retrieved <span className="num">{f.retrievedAt}</span>
          </li>
          <li>
            Price and 52 week range: {run.quote.price.source ?? "not obtained"}, as of <span className="num">{run.quote.price.asOf ?? "not obtained"}</span>
          </li>
          <li>
            Valuations: {v.engine}, run via {v.runner} at <span className="num">{v.ranAt}</span>
          </li>
          <li>Narrative and judgments: {run.narrativeSource}</li>
          <li>Earnings quality: fixed rules in src/lib/quality.ts on the 10-K data above</li>
        </ul>
      </TabsContent>
    </Tabs>
  );
}
