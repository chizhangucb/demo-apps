// Earnings quality review (skill step 2, forensic accounting) as fixed, auditable rules.
// Grade C caps the action at wait and see; grade D is always avoid.
import type { CheckStatus, CompanyProfile, Fact, Fundamentals, Grade, MetricKey, QualityCheck, QualityResult } from "./types";

const v = (f: Fundamentals, k: MetricKey, i: number) => f.metrics[k][i]?.value ?? null;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

function derived(f: Fundamentals, value: number | null, keys: MetricKey[], note?: string): Fact {
  const end = f.fiscalYears.at(-1) ?? null;
  if (value === null || !Number.isFinite(value)) {
    const missing = keys.filter((k) => f.metrics[k].some((x) => x.value === null));
    return { value: null, source: null, asOf: end, note: note ?? (missing.length ? `Missing input: ${missing.join(", ")}` : "Not computable") };
  }
  return { value, source: `Derived: SEC 10-K ${end ? `FY${end.slice(0, 4)}` : ""}`.trim(), asOf: end, detail: `Inputs: ${keys.join(", ")}` };
}

function check(id: string, label: string, value: Fact, display: (x: number) => string, rule: string, grade: (x: number) => CheckStatus): QualityCheck {
  return { id, label, value, display: value.value === null ? "not obtained" : display(value.value), status: value.value === null ? "not obtained" : grade(value.value), rule };
}

/** Beneish M-Score with all eight inputs, or "not obtained" naming what is missing. */
export function beneish(f: Fundamentals) {
  const t = f.fiscalYears.length - 1;
  const p = t - 1;
  const g = (k: MetricKey, i: number) => (i >= 0 ? v(f, k, i) : null);
  const ratio = (a: number | null, b: number | null) => (a === null || b === null || b === 0 ? null : a / b);
  const div = (a: number | null, b: number | null) => (a === null || b === null || b === 0 ? null : a / b);
  const aq = (i: number) => {
    const ca = g("currentAssets", i), ppe = g("ppe", i), ta = g("assets", i);
    return ca === null || ppe === null || ta === null ? null : 1 - (ca + ppe) / ta;
  };
  const gm = (i: number) => ratio(g("grossProfit", i), g("revenue", i));
  const dep = (i: number) => {
    const d = g("depreciation", i), ppe = g("ppe", i);
    return d === null || ppe === null ? null : d / (d + ppe);
  };
  const lev = (i: number) => {
    const cl = g("currentLiabilities", i), debt = g("debt", i), ta = g("assets", i);
    return cl === null || debt === null || ta === null ? null : (cl + debt) / ta;
  };
  const ni = g("netIncome", t), cfo = g("cfo", t), ta = g("assets", t);
  const components: Record<string, number | null> = {
    DSRI: div(ratio(g("receivables", t), g("revenue", t)), ratio(g("receivables", p), g("revenue", p))),
    GMI: div(gm(p), gm(t)),
    AQI: div(aq(t), aq(p)),
    SGI: div(g("revenue", t), g("revenue", p)),
    DEPI: div(dep(p), dep(t)),
    SGAI: div(ratio(g("sga", t), g("revenue", t)), ratio(g("sga", p), g("revenue", p))),
    LVGI: div(lev(t), lev(p)),
    TATA: ni === null || cfo === null || ta === null ? null : (ni - cfo) / ta,
  };
  const missing = Object.entries(components).filter(([, x]) => x === null).map(([k]) => k);
  const c = components as Record<string, number>;
  const m = missing.length
    ? null
    : -4.84 + 0.92 * c.DSRI + 0.528 * c.GMI + 0.404 * c.AQI + 0.892 * c.SGI + 0.115 * c.DEPI - 0.172 * c.SGAI + 4.679 * c.TATA - 0.327 * c.LVGI;
  const fact = derived(f, m, ["receivables", "revenue", "grossProfit", "currentAssets", "ppe", "assets", "depreciation", "sga", "currentLiabilities", "debt", "netIncome", "cfo"],
    missing.length ? `M-Score needs all eight inputs; missing ${missing.join(", ")}` : undefined);
  return { m: fact, components, missing };
}

export function gradeEarningsQuality(f: Fundamentals, profile: CompanyProfile): QualityResult {
  const t = f.fiscalYears.length - 1;
  const sum = (k: MetricKey, n: number) => {
    const xs = f.metrics[k].slice(-n).map((x) => x.value);
    return xs.length < n || xs.some((x) => x === null) ? null : (xs as number[]).reduce((a, b) => a + b, 0);
  };
  const cfo3 = sum("cfo", 3), ni3 = sum("netIncome", 3);
  const conversion = cfo3 === null || ni3 === null || ni3 <= 0 ? null : cfo3 / ni3;
  const ni = v(f, "netIncome", t), cfo = v(f, "cfo", t), a1 = v(f, "assets", t), a0 = v(f, "assets", t - 1);
  const accrual = ni === null || cfo === null || a1 === null || a0 === null ? null : (ni - cfo) / ((a1 + a0) / 2);
  const rel = (k: MetricKey) => {
    const x1 = v(f, k, t), x0 = v(f, k, t - 1), r1 = v(f, "revenue", t), r0 = v(f, "revenue", t - 1);
    return x1 === null || x0 === null || !r1 || !r0 || x0 === 0 ? null : x1 / r1 / (x0 / r0);
  };
  const sbc = v(f, "sbc", t), rev = v(f, "revenue", t);
  const sbcShare = sbc === null || !rev ? null : sbc / rev;
  const red = profile.filings.filter((e) => e.flag === "red");
  const amber = profile.filings.filter((e) => e.flag === "amber");
  const nonReliance = profile.filings.some((e) => e.items.includes("4.02"));
  const govFact: Fact = {
    value: red.length * 10 + amber.length,
    source: "SEC submissions index",
    asOf: profile.filings[0]?.filed ?? f.retrievedAt.slice(0, 10),
    detail: [...red, ...amber].map((e) => `${e.form} ${e.filed}: ${e.summary}`).join("; ") || "No flagged filings in window",
  };

  const checks: QualityCheck[] = [
    conversion === null && cfo3 !== null && ni3 !== null
      ? {
          // Ratio is undefined with a 3y net loss: judge on the sign of cash flow instead.
          id: "conversion",
          label: "Cash conversion, 3y CFO / net income",
          value: { ...derived(f, cfo3, ["cfo", "netIncome"]), note: "3y net income not positive" },
          display: `n/a, 3y net loss; CFO ${cfo3 >= 0 ? "positive" : "negative"}`,
          status: cfo3 >= 0 ? "warn" : "fail",
          rule: "with a 3y net loss: fail if 3y CFO is also negative",
        }
      : check("conversion", "Cash conversion, 3y CFO / net income", derived(f, conversion, ["cfo", "netIncome"]), (x) => `${x.toFixed(2)}x`,
          "fail < 0.5x, warn < 0.8x", (x) => (x < 0.5 ? "fail" : x < 0.8 ? "warn" : "pass")),
    check("accruals", "Sloan accrual ratio, (NI - CFO) / avg assets", derived(f, accrual, ["netIncome", "cfo", "assets"]), pct,
      "fail > 10%, warn > 5%", (x) => (x > 0.1 ? "fail" : x > 0.05 ? "warn" : "pass")),
    check("dsri", "Receivables vs revenue (DSRI)", derived(f, rel("receivables"), ["receivables", "revenue"]), (x) => `${x.toFixed(2)}x`,
      "fail > 1.40, warn > 1.15", (x) => (x > 1.4 ? "fail" : x > 1.15 ? "warn" : "pass")),
    check("inventory", "Inventory vs revenue", derived(f, rel("inventory"), ["inventory", "revenue"]), (x) => `${x.toFixed(2)}x`,
      "fail > 1.40, warn > 1.15", (x) => (x > 1.4 ? "fail" : x > 1.15 ? "warn" : "pass")),
    check("sbc", "Stock based comp / revenue", derived(f, sbcShare, ["sbc", "revenue"]), pct,
      "fail > 10%, warn > 5%", (x) => (x > 0.1 ? "fail" : x > 0.05 ? "warn" : "pass")),
    {
      id: "governance",
      label: "Governance filings (auditor change, late filing, listing notice)",
      value: govFact,
      display: red.length || amber.length ? `${red.length} red, ${amber.length} amber` : "none flagged",
      status: red.length ? "fail" : amber.length ? "warn" : "pass",
      rule: "fail on 4.01 / 4.02 / NT filings, warn on 3.01 / 10-K/A",
    },
  ];

  const b = beneish(f);
  if (b.m.value !== null) {
    checks.push(check("beneish", "Beneish M-Score", b.m, (x) => x.toFixed(2), "fail > -1.78, warn > -2.22", (x) => (x > -1.78 ? "fail" : x > -2.22 ? "warn" : "pass")));
  }

  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;
  const grade: Grade = nonReliance || fails >= 3 ? "D" : fails >= 1 ? "C" : warns >= 2 ? "B" : "A";
  const summary =
    grade === "D"
      ? `${fails} hard fails${nonReliance ? " including a non-reliance filing" : ""}. Grade D: always avoid.`
      : grade === "C"
        ? `${fails} hard fail${fails > 1 ? "s" : ""}. Grade C: action capped at wait and see.`
        : grade === "B"
          ? `${warns} warnings, no hard fails.`
          : "No hard fails and at most one warning.";
  return { grade, checks, beneish: b, summary };
}

export const vetoesBuy = (g: Grade) => g === "C" || g === "D";
