// Shared shapes. Money is USD millions unless a field says per share; shares are millions.

/** A sourced figure. value null means "not obtained"; never fill it from memory. */
export type Fact = {
  value: number | null;
  source: string | null; // short tag, e.g. "SEC 10-K FY2026"
  asOf: string | null; // period end or quote time (ISO date or datetime)
  detail?: string; // long form: concept, accession, filed date
  note?: string; // why it is missing, or a caveat
};

export type MetricKey =
  | "revenue"
  | "grossProfit"
  | "opIncome"
  | "netIncome"
  | "cfo"
  | "capex"
  | "receivables"
  | "inventory"
  | "assets"
  | "currentAssets"
  | "currentLiabilities"
  | "ppe"
  | "equity"
  | "cash"
  | "debt"
  | "sbc"
  | "sga"
  | "depreciation"
  | "dilutedShares";

export type Fundamentals = {
  ticker: string;
  cik: string;
  name: string;
  fiscalYears: string[]; // period end dates, oldest first (up to 4)
  metrics: Record<MetricKey, Fact[]>; // aligned with fiscalYears
  sharesOutstanding: Fact; // millions, dei cover page
  retrievedAt: string;
};

export type GovernanceEvent = {
  form: string;
  filed: string;
  items: string[];
  accession: string;
  flag: "red" | "amber" | null;
  summary: string;
};

export type CompanyProfile = {
  ticker: string;
  cik: string;
  name: string;
  sic: Fact & { label?: string };
  fiscalYearEnd: string | null;
  exchange: string | null;
  filings: GovernanceEvent[]; // recent 8-K / NT / 10-K/A, newest first
};

export type Quote = {
  price: Fact; // per share
  low52: Fact;
  high52: Fact;
};

export type CheckStatus = "pass" | "warn" | "fail" | "not obtained";

export type QualityCheck = {
  id: string;
  label: string;
  value: Fact; // ratio values carry the source of their inputs
  display: string;
  status: CheckStatus;
  rule: string;
};

export type Grade = "A" | "B" | "C" | "D";

export type QualityResult = {
  grade: Grade;
  checks: QualityCheck[];
  beneish: { m: Fact; components: Record<string, number | null>; missing: string[] };
  summary: string;
};

/** dcf.py config, exactly the upstream schema. */
export type DcfScenario = {
  name: string;
  prob: number;
  revenue: number[];
  fcf_margin: number[];
  fade_years?: number;
  fade_g_start?: number;
  annual_dilution?: number;
};

export type DcfConfig = {
  price: number;
  shares: number;
  net_debt: number;
  wacc: number;
  terminal_g: number;
  scenarios: DcfScenario[];
  sensitivity?: { scenario: string; wacc: number[]; g: number[] };
  reverse?: { interim_fcf: number[]; steady_margins: number[]; base_revenue: number };
  pvgo?: { earnings_ps: number; r?: number };
  epv?: Record<string, unknown>;
  eva?: Record<string, unknown>;
  montecarlo?: Record<string, unknown>;
  range_low?: number;
  range_high?: number;
};

/** The judgment knobs an analyst (Claude or the sample script) sets; numbers are derived from them. */
export type AssumptionInputs = {
  wacc: number;
  terminal_g: number;
  scenarios: Record<"bear" | "base" | "bull", { prob: number; growth_start: number; growth_end: number; fcf_margin_target: number }>;
  rationale: string;
};

export type ValuationRange = { id: string; method: string; low: number; high: number; mid: number };

export type Valuation = {
  engine: string;
  python: string;
  price: number | null;
  ranges: ValuationRange[];
  scenarios?: Record<string, { prob: number; per_share: number; ev: number; tv_share: number; exit_pfcf: number; tv_warning: boolean }>;
  weighted?: number;
  sensitivity?: { scenario: string; wacc: number[]; g: number[]; grid: number[][] };
  reverse?: { ev: number; pv_interim: number; fcf_required: number; rows: { margin: number; revenue_required: number; implied_cagr: number | null }[] };
  pvgo?: { zero_growth_ps: number; pvgo_ps: number; pvgo_pct: number };
  epv?: { epv_ps: number; growth_ps: number | null; asset_ps: number | null };
  eva?: { per_share: number; low: number; high: number };
  montecarlo?: { p10: number; p25: number; p50: number; p75: number; p90: number; mean: number; p_loss: number | null; n: number };
  composite?: { low: number; high: number; rule: string };
  calibrate?: { label: string; label_zh: string };
  transcript: string;
  ranAt: string;
  runner: string; // "python3 (local)", "Vercel Python function", "precomputed"
};

/** Prose that Claude (live) or the sample script writes. Judgments only; figures come from data. */
export type Narrative = {
  thesis: string; // independent view, falsifiable
  falsifiers: string[];
  near_term: string | null; // null renders "not obtained"
  counter_case: string[];
  premortem: string;
  chapters: Record<string, { paragraphs: string[]; my_view: string }>; // keys "1".."9"
  gap_falsifiers: Record<string, string>; // keyed by gap row id
};

export type ResearchRun = {
  mode: "sample" | "live";
  generatedAt: string;
  notice: string | null;
  narrativeSource: string;
  company: CompanyProfile;
  quote: Quote;
  fundamentals: Fundamentals;
  quality: QualityResult;
  inputs: AssumptionInputs;
  assumptions: DcfConfig;
  valuation: Valuation;
  narrative: Narrative;
};
