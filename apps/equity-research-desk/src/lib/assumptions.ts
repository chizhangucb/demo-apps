// Turns judgment knobs (AssumptionInputs) plus sourced fundamentals into a dcf.py config.
// The knobs are the "My view" part; everything else is arithmetic on filed numbers.
import type { AssumptionInputs, DcfConfig, Fundamentals, MetricKey, Quote } from "./types";

export const TAX_RATE = 0.21;
const YEARS = 5;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
const r1 = (x: number) => Math.round(x * 10) / 10;

const lastVal = (f: Fundamentals, k: MetricKey) => f.metrics[k].at(-1)?.value ?? null;
const avg = (xs: (number | null)[]) => {
  const ok = xs.filter((x): x is number => x !== null);
  return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null;
};

export function trailingCagr(f: Fundamentals): number | null {
  const rev = f.metrics.revenue.map((x) => x.value);
  const n = rev.length - 1;
  const a = rev[0], b = rev[n];
  return n < 1 || a === null || b === null || a <= 0 || b <= 0 ? null : (b / a) ** (1 / n) - 1;
}

/** Normalized NOPAT margin: average operating margin over the filed years, after a flat 21% tax. */
export function nopatMargin(f: Fundamentals): number | null {
  const m = f.fiscalYears.map((_, i) => {
    const op = f.metrics.opIncome[i].value, rev = f.metrics.revenue[i].value;
    return op === null || !rev ? null : op / rev;
  });
  const a = avg(m);
  return a === null ? null : a * (1 - TAX_RATE);
}

export function fcfMarginHistory(f: Fundamentals): number | null {
  return avg(
    f.fiscalYears.map((_, i) => {
      const cfo = f.metrics.cfo[i].value, capex = f.metrics.capex[i].value, rev = f.metrics.revenue[i].value;
      return cfo === null || capex === null || !rev ? null : (cfo - capex) / rev;
    }),
  );
}

/** Scripted default knobs: what the sample analyst uses when Claude is not in the loop. */
export function defaultInputs(f: Fundamentals): AssumptionInputs {
  const cagr = clamp(trailingCagr(f) ?? 0.05, -0.05, 0.4);
  const nopat = clamp(nopatMargin(f) ?? 0.05, 0.01, 0.4);
  const hist = fcfMarginHistory(f) ?? nopat * 0.5;
  return {
    wacc: 0.1,
    terminal_g: 0.03,
    scenarios: {
      bear: { prob: 0.25, growth_start: r4(clamp(cagr * 0.3, -0.05, 0.15)), growth_end: 0.02, fcf_margin_target: r4(clamp(hist, 0.01, nopat * 0.6)) },
      base: { prob: 0.5, growth_start: r4(clamp(cagr * 0.7, 0, 0.3)), growth_end: 0.05, fcf_margin_target: r4(nopat * 0.7) },
      bull: { prob: 0.25, growth_start: r4(clamp(cagr, 0.02, 0.45)), growth_end: 0.08, fcf_margin_target: r4(nopat * 0.95) },
    },
    rationale:
      "Scripted defaults: 10% WACC and 3% terminal growth. Growth starts from a share of the filed revenue CAGR and fades linearly; FCF margin converges to a share of the normalized after-tax operating margin (bear uses the filed FCF margin history, floored at 1%).",
  };
}

export function sanitizeInputs(x: AssumptionInputs): AssumptionInputs {
  const sc = x.scenarios;
  const total = sc.bear.prob + sc.base.prob + sc.bull.prob || 1;
  const fix = (s: AssumptionInputs["scenarios"]["base"]) => ({
    prob: r4(s.prob / total),
    growth_start: r4(clamp(s.growth_start, -0.3, 0.8)),
    growth_end: r4(clamp(s.growth_end, -0.1, 0.3)),
    fcf_margin_target: r4(clamp(s.fcf_margin_target, -0.2, 0.7)),
  });
  const wacc = r4(clamp(x.wacc, 0.05, 0.2));
  const fixed = { bear: fix(sc.bear), base: fix(sc.base), bull: fix(sc.bull) };
  // Probabilities must sum to exactly 1 for dcf.py to print a weighted value.
  fixed.base.prob = r4(1 - fixed.bear.prob - fixed.bull.prob);
  return { wacc, terminal_g: r4(clamp(x.terminal_g, 0, Math.min(0.05, wacc - 0.02))), scenarios: fixed, rationale: x.rationale };
}

function path(start: number, end: number, from: number, to: number) {
  const growth = Array.from({ length: YEARS }, (_, i) => start + ((end - start) * i) / (YEARS - 1));
  const margin = Array.from({ length: YEARS }, (_, i) => from + ((to - from) * (i + 1)) / YEARS);
  return { growth, margin };
}

export type BuildNotes = { netDebtNote: string; sharesNote: string };

export function buildConfig(f: Fundamentals, quote: Quote, raw: AssumptionInputs): { config: DcfConfig; notes: BuildNotes } {
  const inputs = sanitizeInputs(raw);
  const price = quote.price.value ?? 0;
  const shares = f.sharesOutstanding.value ?? lastVal(f, "dilutedShares") ?? 1;
  const rev0 = lastVal(f, "revenue") ?? 1;
  const cash = lastVal(f, "cash") ?? 0;
  const debt = lastVal(f, "debt");
  const net_debt = r1((debt ?? 0) - cash);
  const opInc = lastVal(f, "opIncome") ?? 0;
  const equity = lastVal(f, "equity") ?? 0;
  const nopatNow = opInc * (1 - TAX_RATE);
  const nopatNorm = (nopatMargin(f) ?? 0.05) * rev0;
  const cfo = lastVal(f, "cfo"), capex = lastVal(f, "capex");
  const fcfNow = cfo !== null && capex !== null ? (cfo - capex) / rev0 : inputs.scenarios.base.fcf_margin_target / 2;

  const scenarios = (["bear", "base", "bull"] as const).map((name) => {
    const s = inputs.scenarios[name];
    const p = path(s.growth_start, s.growth_end, clamp(fcfNow, -0.1, 0.5), s.fcf_margin_target);
    let r = rev0;
    const revenue = p.growth.map((g) => (r = r * (1 + g)));
    return {
      name,
      prob: s.prob,
      revenue: revenue.map(r1),
      fcf_margin: p.margin.map(r4),
      fade_years: 5,
      fade_g_start: s.growth_end,
      annual_dilution: 0.01,
    };
  });
  const base = scenarios[1];
  const ic = Math.max(equity + (debt ?? 0) - cash, equity * 0.5, 1);
  const roic = nopatNow / ic;
  const baseCagr = (base.revenue[YEARS - 1] / rev0) ** (1 / YEARS) - 1;

  const config: DcfConfig = {
    price,
    shares: r1(shares),
    net_debt,
    wacc: inputs.wacc,
    terminal_g: inputs.terminal_g,
    scenarios,
    sensitivity: { scenario: "base", wacc: [r4(inputs.wacc - 0.01), inputs.wacc, r4(inputs.wacc + 0.01)], g: [0.02, 0.03, 0.04].filter((g) => g < inputs.wacc - 0.01) },
    reverse: {
      interim_fcf: base.revenue.map((x, i) => r1(x * base.fcf_margin[i])),
      steady_margins: [inputs.scenarios.base.fcf_margin_target, inputs.scenarios.bull.fcf_margin_target].map((m) => r4(Math.max(m, 0.005))),
      base_revenue: r1(rev0),
    },
    pvgo: { earnings_ps: r4(nopatNorm / shares) },
    epv: {
      earnings_basis: "NOPAT",
      normalized_earnings: r1(nopatNorm),
      coc: inputs.wacc,
      net_debt,
      shares: r1(shares),
      asset_value: r1(equity),
      price,
      growth: { g: inputs.terminal_g, roiic: r4(Math.max(roic, 0.001)), mode: "franchise" },
    },
    eva: { invested_capital: r1(ic), nopat: r1(nopatNow), fade_years: 10, nopat_growth: r4(clamp(baseCagr / 2, 0, 0.15)) },
    montecarlo: {
      n: 2000,
      seed: 42,
      base_revenue: r1(rev0),
      years: YEARS,
      growth_mean: r4(baseCagr),
      growth_std: 0.06,
      margin_low: r4(Math.min(inputs.scenarios.bear.fcf_margin_target, inputs.scenarios.base.fcf_margin_target)),
      margin_mode: inputs.scenarios.base.fcf_margin_target,
      margin_high: r4(Math.max(inputs.scenarios.bull.fcf_margin_target, inputs.scenarios.base.fcf_margin_target + 0.001)),
      terminal_g: inputs.terminal_g,
    },
  };
  const notes: BuildNotes = {
    netDebtNote: debt === null ? "Debt not obtained from filings; net debt uses cash only." : "Net debt = filed debt minus cash and equivalents.",
    sharesNote: f.sharesOutstanding.value !== null ? "Shares from the latest 10-K cover page." : "Cover page shares not obtained; diluted weighted average used.",
  };
  return { config, notes };
}
