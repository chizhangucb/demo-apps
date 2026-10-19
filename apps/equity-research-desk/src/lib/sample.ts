// The bundled SAMPLE run: cached EDGAR excerpt + cached quote + dcf.py output + scripted narrative.
// Pure data, safe to import on the client and server. Works with zero secrets.
import companyfacts from "../../data/sample/smci-companyfacts.json";
import submissions from "../../data/sample/smci-submissions.json";
import quote from "../../data/sample/smci-quote.json";
import inputs from "../../data/sample/smci-inputs.json";
import assumptions from "../../data/sample/smci-assumptions.json";
import valuation from "../../data/sample/smci-valuation.json";
import narrative from "../../data/sample/smci-narrative.json";
import { extractFundamentals, extractProfile, type CompanyFacts, type Submissions } from "./edgar";
import { gradeEarningsQuality } from "./quality";
import type { AssumptionInputs, DcfConfig, Narrative, Quote, ResearchRun, Valuation } from "./types";

export const SAMPLE_TICKER = "SMCI";
export const SAMPLE_RETRIEVED_AT = "2026-10-19T16:28:00Z";

export const governanceSince = (retrievedAt: string) => {
  const d = new Date(retrievedAt);
  d.setUTCFullYear(d.getUTCFullYear() - 3);
  return d.toISOString().slice(0, 10);
};

export function sampleRun(notice: string | null = null): ResearchRun {
  const fundamentals = extractFundamentals(companyfacts as unknown as CompanyFacts, SAMPLE_TICKER, SAMPLE_RETRIEVED_AT);
  const company = extractProfile(submissions as unknown as Submissions, SAMPLE_TICKER, SAMPLE_RETRIEVED_AT, governanceSince(SAMPLE_RETRIEVED_AT));
  return {
    mode: "sample",
    generatedAt: SAMPLE_RETRIEVED_AT,
    notice,
    narrativeSource: "Scripted sample analyst (no Claude call)",
    company,
    quote: quote as Quote,
    fundamentals,
    quality: gradeEarningsQuality(fundamentals, company),
    inputs: inputs as AssumptionInputs,
    assumptions: assumptions as unknown as DcfConfig,
    valuation: valuation as unknown as Valuation,
    narrative: narrative as Narrative,
  };
}
