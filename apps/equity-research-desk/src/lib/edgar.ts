// Pure parsers for SEC EDGAR companyfacts and submissions JSON. No network here.
import type { CompanyProfile, Fact, Fundamentals, GovernanceEvent, MetricKey } from "./types";

type XbrlRow = { start?: string; end: string; val: number; accn: string; fy?: number; fp?: string; form: string; filed: string };
type Concept = { units: Record<string, XbrlRow[]> };
export type CompanyFacts = { cik: number | string; entityName: string; facts: Record<string, Record<string, Concept>> };
export type Submissions = {
  cik: string;
  name: string;
  sic?: string;
  sicDescription?: string;
  fiscalYearEnd?: string;
  exchanges?: string[];
  filings: { recent: { form: string[]; filingDate: string[]; items: string[]; accessionNumber: string[] } };
};

/** XBRL concepts tried in order, per metric. Duration concepts are annual flows. */
export const CONCEPTS: Record<MetricKey, { tags: string[]; duration: boolean; scale?: number }> = {
  revenue: { tags: ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"], duration: true },
  grossProfit: { tags: ["GrossProfit"], duration: true },
  opIncome: { tags: ["OperatingIncomeLoss"], duration: true },
  netIncome: { tags: ["NetIncomeLoss"], duration: true },
  cfo: { tags: ["NetCashProvidedByUsedInOperatingActivities"], duration: true },
  capex: { tags: ["PaymentsToAcquirePropertyPlantAndEquipment"], duration: true },
  receivables: { tags: ["AccountsReceivableNetCurrent"], duration: false },
  inventory: { tags: ["InventoryNet"], duration: false },
  assets: { tags: ["Assets"], duration: false },
  currentAssets: { tags: ["AssetsCurrent"], duration: false },
  currentLiabilities: { tags: ["LiabilitiesCurrent"], duration: false },
  ppe: { tags: ["PropertyPlantAndEquipmentNet"], duration: false },
  equity: { tags: ["StockholdersEquity"], duration: false },
  cash: { tags: ["CashAndCashEquivalentsAtCarryingValue"], duration: false },
  debt: {
    tags: ["LongTermDebt", "DebtLongtermAndShorttermCombinedAmount", "ConvertibleLongTermNotesPayable", "LongTermDebtNoncurrent"],
    duration: false,
  },
  sbc: { tags: ["ShareBasedCompensation", "AllocatedShareBasedCompensationExpense"], duration: true },
  sga: { tags: ["SellingGeneralAndAdministrativeExpense"], duration: true },
  depreciation: { tags: ["DepreciationDepletionAndAmortization", "DepreciationAndAmortization", "Depreciation"], duration: true },
  dilutedShares: { tags: ["WeightedAverageNumberOfDilutedSharesOutstanding"], duration: true },
};

export const METRIC_LABELS: Record<MetricKey, string> = {
  revenue: "Revenue",
  grossProfit: "Gross profit",
  opIncome: "Operating income",
  netIncome: "Net income",
  cfo: "Operating cash flow",
  capex: "Capex",
  receivables: "Receivables",
  inventory: "Inventory",
  assets: "Total assets",
  currentAssets: "Current assets",
  currentLiabilities: "Current liabilities",
  ppe: "PP&E, net",
  equity: "Shareholders' equity",
  cash: "Cash and equivalents",
  debt: "Debt",
  sbc: "Stock based comp",
  sga: "SG&A",
  depreciation: "D&A",
  dilutedShares: "Diluted shares (m)",
};

const DAY = 86_400_000;

/** Annual 10-K values for one concept, keyed by period end; the latest filing wins (restatements). */
function annual(concept: Concept | undefined, duration: boolean): Map<string, XbrlRow> {
  const out = new Map<string, XbrlRow>();
  if (!concept) return out;
  const rows = Object.values(concept.units)[0] ?? [];
  for (const r of rows) {
    if (r.form !== "10-K" || r.fp !== "FY") continue;
    if (duration) {
      if (!r.start) continue;
      const days = (Date.parse(r.end) - Date.parse(r.start)) / DAY;
      if (days < 350 || days > 380) continue;
    } else if (r.start) continue;
    const prev = out.get(r.end);
    if (!prev || r.filed > prev.filed) out.set(r.end, r);
  }
  return out;
}

const fyLabel = (end: string) => `FY${end.slice(0, 4)}`;

export function extractFundamentals(cf: CompanyFacts, ticker: string, retrievedAt: string, years = 4): Fundamentals {
  const gaap = cf.facts["us-gaap"] ?? {};
  const series = {} as Record<MetricKey, Map<string, { row: XbrlRow; tag: string }>>;
  for (const key of Object.keys(CONCEPTS) as MetricKey[]) {
    const merged = new Map<string, { row: XbrlRow; tag: string }>();
    // First concept that has a value for a given year wins for that year.
    for (const tag of CONCEPTS[key].tags) {
      for (const [end, row] of annual(gaap[tag], CONCEPTS[key].duration)) if (!merged.has(end)) merged.set(end, { row, tag });
    }
    series[key] = merged;
  }
  const anchor = series.revenue.size ? series.revenue : series.netIncome;
  const fiscalYears = [...anchor.keys()].sort().slice(-years);
  const metrics = {} as Record<MetricKey, Fact[]>;
  for (const key of Object.keys(CONCEPTS) as MetricKey[]) {
    metrics[key] = fiscalYears.map((end) => {
      const hit = series[key].get(end);
      if (!hit) return { value: null, source: null, asOf: end, note: `No 10-K value tagged for ${CONCEPTS[key].tags.join(" / ")}` };
      return {
        value: hit.row.val / 1e6,
        source: `SEC 10-K ${fyLabel(end)}`,
        asOf: end,
        detail: `us-gaap:${hit.tag}, accession ${hit.row.accn}, filed ${hit.row.filed}`,
      };
    });
  }
  const dei = cf.facts.dei?.EntityCommonStockSharesOutstanding;
  const deiRows = dei ? (Object.values(dei.units)[0] ?? []) : [];
  const lastShares = [...deiRows].sort((a, b) => (a.filed + a.end).localeCompare(b.filed + b.end)).at(-1);
  const sharesOutstanding: Fact = lastShares
    ? {
        value: lastShares.val / 1e6,
        source: `SEC ${lastShares.form} cover`,
        asOf: lastShares.end,
        detail: `dei:EntityCommonStockSharesOutstanding, accession ${lastShares.accn}, filed ${lastShares.filed}`,
      }
    : { value: null, source: null, asOf: null, note: "dei:EntityCommonStockSharesOutstanding not reported" };
  return { ticker, cik: String(cf.cik).padStart(10, "0"), name: cf.entityName, fiscalYears, metrics, sharesOutstanding, retrievedAt };
}

const ITEM_TEXT: Record<string, string> = {
  "1.01": "material agreement",
  "1.02": "agreement terminated",
  "2.02": "results of operations",
  "2.03": "new financial obligation",
  "2.05": "restructuring costs",
  "2.06": "material impairment",
  "3.01": "listing rule notice",
  "3.02": "unregistered equity sale",
  "4.01": "auditor change",
  "4.02": "non-reliance on prior financials",
  "5.02": "officer or director change",
  "5.03": "charter or bylaw change",
  "5.07": "shareholder vote",
  "7.01": "Reg FD disclosure",
  "8.01": "other events",
};

function classify(form: string, items: string[]): { flag: GovernanceEvent["flag"]; summary: string } {
  if (form.startsWith("NT ")) return { flag: "red", summary: `Late filing notice (${form})` };
  if (form === "10-K/A") return { flag: "amber", summary: "Amended annual report" };
  const named = items.filter((i) => i !== "9.01").map((i) => ITEM_TEXT[i] ?? `item ${i}`);
  const summary = named.length ? named.join(", ") : "exhibits only";
  if (items.includes("4.02") || items.includes("4.01")) return { flag: "red", summary };
  if (items.includes("3.01")) return { flag: "amber", summary };
  return { flag: null, summary };
}

/** Recent governance relevant filings from the submissions index, newest first. */
export function extractProfile(sub: Submissions, ticker: string, retrievedAt: string, since: string): CompanyProfile {
  const r = sub.filings.recent;
  const filings: GovernanceEvent[] = [];
  for (let i = 0; i < r.form.length; i++) {
    const form = r.form[i];
    if (r.filingDate[i] < since) continue;
    if (!["8-K", "8-K/A", "10-K/A", "NT 10-K", "NT 10-Q"].includes(form)) continue;
    const items = (r.items[i] || "").split(",").filter(Boolean);
    filings.push({ form, filed: r.filingDate[i], items, accession: r.accessionNumber[i], ...classify(form, items) });
  }
  filings.sort((a, b) => b.filed.localeCompare(a.filed));
  return {
    ticker,
    cik: String(sub.cik).padStart(10, "0"),
    name: sub.name,
    sic: sub.sic
      ? { value: Number(sub.sic), label: sub.sicDescription, source: "SEC submissions", asOf: retrievedAt.slice(0, 10) }
      : { value: null, source: null, asOf: null, note: "SIC not in submissions index" },
    fiscalYearEnd: sub.fiscalYearEnd ?? null,
    exchange: sub.exchanges?.[0] ?? null,
    filings,
  };
}

export const last = (facts: Fact[]) => facts.at(-1) ?? { value: null, source: null, asOf: null };
