// Derived views over a ResearchRun: football field rows, expectations gap, decision triad.
import { vetoesBuy } from "./quality";
import type { Fact, ResearchRun } from "./types";

export const NOT_OBTAINED = "not obtained";

export type FieldRow = { id: string; method: string; low: number | null; high: number | null; mid: number | null; kind: "market" | "method" | "composite"; fact: Fact };

export function footballField(run: ResearchRun): FieldRow[] {
  const v = run.valuation;
  const tag: Fact = { value: 1, source: "dcf.py", asOf: v.ranAt, detail: `${v.engine}, ${v.runner}` };
  const rows: FieldRow[] = [];
  const { low52, high52 } = run.quote;
  rows.push({
    id: "market",
    method: "Market, 52 week range",
    low: low52.value,
    high: high52.value,
    mid: run.quote.price.value,
    kind: "market",
    fact: low52.value === null ? low52 : { ...low52, value: 1 },
  });
  for (const r of v.ranges) rows.push({ ...r, kind: "method", fact: tag });
  rows.push({
    id: "relative",
    method: "Relative, peer multiples",
    low: null,
    high: null,
    mid: null,
    kind: "method",
    fact: { value: null, source: null, asOf: null, note: "No sourced peer multiple set was gathered for this run" },
  });
  if (v.composite) rows.push({ id: "composite", method: "Composite range", low: v.composite.low, high: v.composite.high, mid: v.weighted ?? null, kind: "composite", fact: { ...tag, detail: v.composite.rule } });
  return rows;
}

export type GapRow = { id: string; label: string; pricedIn: string; pricedInFact: Fact; ourView: string; ourViewFact: Fact; falsifier: string };

const money = (m: number) => (Math.abs(m) >= 1000 ? `$${(m / 1000).toFixed(2)}B` : `$${m.toFixed(0)}m`);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
export const perShare = (x: number) => `$${x.toFixed(2)}`;

export function gapTable(run: ResearchRun): GapRow[] {
  const v = run.valuation;
  const a = run.assumptions;
  const dcfTag = (detail: string): Fact => ({ value: 1, source: "dcf.py", asOf: v.ranAt, detail });
  const viewTag = (detail: string): Fact => ({ value: 1, source: "My view (assumptions)", asOf: v.ranAt, detail });
  const missing = (note: string): Fact => ({ value: null, source: null, asOf: null, note });
  const base = a.scenarios.find((s) => s.name === "base");
  const n = base?.revenue.length ?? 5;
  const rev0 = a.reverse?.base_revenue ?? null;
  const baseCagr = base && rev0 ? (base.revenue[n - 1] / rev0) ** (1 / n) - 1 : null;
  const baseFcf = base ? base.revenue[n - 1] * base.fcf_margin[n - 1] : null;
  const implied = v.reverse?.rows[0];
  const fals = run.narrative.gap_falsifiers;
  const rows: GapRow[] = [];

  rows.push({
    id: "revenue_cagr",
    label: `Revenue CAGR, ${n}y`,
    pricedIn: implied?.implied_cagr != null ? pct(implied.implied_cagr) : NOT_OBTAINED,
    pricedInFact: implied ? dcfTag(`Reverse DCF at ${pct(implied.margin)} steady FCF margin`) : missing("Reverse DCF needs a price"),
    ourView: baseCagr !== null ? pct(baseCagr) : NOT_OBTAINED,
    ourViewFact: baseCagr !== null ? viewTag("Base scenario revenue path") : missing("No base scenario"),
    falsifier: fals.revenue_cagr ?? "Two consecutive 10-Qs with revenue growth below the priced-in rate.",
  });
  rows.push({
    id: "steady_fcf",
    label: "Steady-state FCF / yr",
    pricedIn: v.reverse ? money(v.reverse.fcf_required) : NOT_OBTAINED,
    pricedInFact: v.reverse ? dcfTag("Reverse DCF: FCF the price requires after the interim years") : missing("Reverse DCF needs a price"),
    ourView: baseFcf !== null ? money(baseFcf) : NOT_OBTAINED,
    ourViewFact: baseFcf !== null ? viewTag(`Base year ${n} revenue x FCF margin`) : missing("No base scenario"),
    falsifier: fals.steady_fcf ?? "Operating cash flow stays negative through the next fiscal year.",
  });
  rows.push({
    id: "growth_share",
    label: "Share of value from growth",
    pricedIn: v.pvgo ? pct(v.pvgo.pvgo_pct) : NOT_OBTAINED,
    pricedInFact: v.pvgo ? dcfTag(`PVGO: price minus zero-growth value ${perShare(v.pvgo.zero_growth_ps)}`) : missing("PVGO not run"),
    ourView: v.pvgo && v.weighted ? pct(1 - v.pvgo.zero_growth_ps / v.weighted) : NOT_OBTAINED,
    ourViewFact: v.pvgo && v.weighted ? dcfTag("1 - zero-growth value / weighted DCF") : missing("Weighted DCF not available"),
    falsifier: fals.growth_share ?? "Normalized after-tax margin falls below the level used for the zero-growth value.",
  });
  rows.push({
    id: "value",
    label: "Value per share",
    pricedIn: run.quote.price.value !== null ? perShare(run.quote.price.value) : NOT_OBTAINED,
    pricedInFact: run.quote.price,
    ourView: v.weighted != null && v.composite ? `${perShare(v.weighted)} (${perShare(v.composite.low)} to ${perShare(v.composite.high)})` : NOT_OBTAINED,
    ourViewFact: v.weighted != null ? dcfTag("Probability weighted DCF, composite range in brackets") : missing("No scenarios"),
    falsifier: fals.value ?? "Price trades through the composite low for a full quarter without new filings to explain it.",
  });
  rows.push({
    id: "quality",
    label: "Earnings quality",
    pricedIn: "Reported earnings at face value",
    pricedInFact: { value: 1, source: "My view (inference)", asOf: v.ranAt, detail: "A price that values the company on reported profit implicitly accepts that profit" },
    ourView: `Grade ${run.quality.grade}`,
    ourViewFact: { value: 1, source: "Forensic rules", asOf: run.fundamentals.retrievedAt, detail: run.quality.summary },
    falsifier: fals.quality ?? "Cash conversion back above 0.8x with receivables and inventory growing no faster than revenue.",
  });
  return rows;
}

export type Action = "Buy" | "Hold" | "Wait and see" | "Reduce" | "Avoid";

export type Decision = {
  intrinsic: string;
  nearTerm: string;
  modelAction: Action;
  finalAction: Action;
  vetoed: boolean;
  vetoReason: string | null;
};

const ACTION_FROM_LABEL: Record<string, Action> = {
  "significantly undervalued": "Buy",
  undervalued: "Buy",
  "fairly valued": "Hold",
  overvalued: "Reduce",
  "significantly overvalued": "Avoid",
};

export function decide(run: ResearchRun): Decision {
  const label = run.valuation.calibrate?.label ?? NOT_OBTAINED;
  let modelAction: Action = ACTION_FROM_LABEL[label] ?? "Wait and see";
  // Skill rule: no independent view, no buy or sell action.
  if (!run.narrative.thesis.trim()) modelAction = "Wait and see";
  const g = run.quality.grade;
  let finalAction = modelAction;
  let vetoReason: string | null = null;
  if (g === "D") {
    finalAction = "Avoid";
    vetoReason = `Earnings quality grade D: always avoid. ${run.quality.summary}`;
  } else if (g === "C" && (modelAction === "Buy" || modelAction === "Hold")) {
    finalAction = "Wait and see";
    vetoReason = `Earnings quality grade C caps the action at wait and see. ${run.quality.summary}`;
  }
  return {
    intrinsic: label,
    nearTerm: run.narrative.near_term ?? NOT_OBTAINED,
    modelAction,
    finalAction,
    vetoed: vetoesBuy(g),
    vetoReason: vetoReason ?? (vetoesBuy(g) ? `Grade ${g} blocks any buy call.` : null),
  };
}

/** Same arithmetic as dcf.run_position: probability weighted return and the up/down asymmetry. */
export function positionSizing(run: ResearchRun) {
  const price = run.quote.price.value;
  const sc = run.valuation.scenarios;
  if (!price || !sc) return null;
  const pairs = Object.values(sc).map((s) => [s.prob, s.per_share / price - 1] as const);
  const ev = pairs.reduce((a, [p, r]) => a + p * r, 0);
  const up = Math.max(0, ...pairs.map(([, r]) => r));
  const down = Math.max(0, ...pairs.map(([, r]) => -r));
  return { ev, up, down, asymmetry: down > 0 ? up / down : Infinity };
}
