// Rebuilds data/sample/ from raw SEC + quote downloads.
// bun scripts/build-sample.ts <companyfacts.json> <submissions.json> <yahoo-chart.json> <retrievedAt ISO>
// Writes a trimmed EDGAR excerpt, the quote, the assumptions JSON and the dcf.py result.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { CONCEPTS, extractFundamentals, type CompanyFacts, type Submissions } from "../src/lib/edgar";
import { buildConfig, defaultInputs } from "../src/lib/assumptions";
import type { Quote } from "../src/lib/types";

const [cfPath, subPath, quotePath, retrievedAt] = process.argv.slice(2);
const OUT = "data/sample";
const write = (name: string, data: unknown) => writeFileSync(`${OUT}/${name}`, JSON.stringify(data, null, 1) + "\n");

const cf = JSON.parse(readFileSync(cfPath, "utf8")) as CompanyFacts;
const keep = new Set(Object.values(CONCEPTS).flatMap((c) => c.tags));
const gaap = Object.fromEntries(
  Object.entries(cf.facts["us-gaap"])
    .filter(([tag]) => keep.has(tag))
    .map(([tag, c]) => [tag, { units: Object.fromEntries(Object.entries(c.units).map(([u, rows]) => [u, rows.filter((r) => r.form === "10-K" && r.end >= "2021-01-01")])) }]),
);
const dei = { EntityCommonStockSharesOutstanding: cf.facts.dei.EntityCommonStockSharesOutstanding };
const excerpt: CompanyFacts = { cik: cf.cik, entityName: cf.entityName, facts: { dei, "us-gaap": gaap } };
write("smci-companyfacts.json", { _excerpt: `Trimmed from https://data.sec.gov/api/xbrl/companyfacts/CIK0001375365.json, retrieved ${retrievedAt}. 10-K rows since 2021 for the concepts this app reads.`, ...excerpt });

const sub = JSON.parse(readFileSync(subPath, "utf8")) as Submissions;
const r = sub.filings.recent;
const idx = r.form.map((_, i) => i).filter((i) => r.filingDate[i] >= "2023-07-01");
write("smci-submissions.json", {
  _excerpt: `Trimmed from https://data.sec.gov/submissions/CIK0001375365.json, retrieved ${retrievedAt}. Filings since 2023-07-01.`,
  cik: sub.cik, name: sub.name, sic: sub.sic, sicDescription: sub.sicDescription, fiscalYearEnd: sub.fiscalYearEnd, exchanges: sub.exchanges,
  filings: { recent: { form: idx.map((i) => r.form[i]), filingDate: idx.map((i) => r.filingDate[i]), items: idx.map((i) => r.items[i]), accessionNumber: idx.map((i) => r.accessionNumber[i]) } },
});

const meta = JSON.parse(readFileSync(quotePath, "utf8")).chart.result[0].meta;
const asOf = new Date(meta.regularMarketTime * 1000).toISOString();
const src = "Yahoo Finance chart API";
const quote: Quote = {
  price: { value: meta.regularMarketPrice, source: src, asOf, detail: `SMCI ${meta.currency} last price, cached for the sample` },
  low52: { value: meta.fiftyTwoWeekLow, source: src, asOf },
  high52: { value: meta.fiftyTwoWeekHigh, source: src, asOf },
};
write("smci-quote.json", quote);

const f = extractFundamentals(excerpt, "SMCI", retrievedAt);
const inputs = defaultInputs(f);
const { config } = buildConfig(f, quote, inputs);
write("smci-inputs.json", inputs);
write("smci-assumptions.json", config);
const run = spawnSync("python3", ["-I", "python/runner.py"], { input: JSON.stringify(config), encoding: "utf8" });
const out = JSON.parse(run.stdout);
if (!out.ok) throw new Error(out.error);
write("smci-valuation.json", { ...out.result, ranAt: retrievedAt, runner: "precomputed by scripts/build-sample.ts" });
console.log("weighted", out.result.weighted, "composite", out.result.composite, out.result.calibrate);
