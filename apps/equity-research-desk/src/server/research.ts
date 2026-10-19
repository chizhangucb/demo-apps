import "server-only";
import { buildConfig, defaultInputs, sanitizeInputs } from "@/lib/assumptions";
import { extractFundamentals, extractProfile } from "@/lib/edgar";
import { gradeEarningsQuality } from "@/lib/quality";
import { governanceSince, sampleRun, SAMPLE_TICKER } from "@/lib/sample";
import type { Fundamentals, Narrative, ResearchRun } from "@/lib/types";
import { liveAvailable, MODEL, proposeInputs, writeNarrative } from "./claude";
import { runDcf } from "./dcf";
import { fetchQuote } from "./quote";
import { companyFacts, lookupCik, submissions } from "./sec";

export const TICKER_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

/** Claude output is untrusted prose: strip em and en dashes to match the house style. */
function scrub<T>(x: T): T {
  if (typeof x === "string") return x.replace(/\s*\u2014\s*/g, ", ").replace(/\u2013/g, " to ") as T;
  if (Array.isArray(x)) return x.map(scrub) as T;
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, scrub(v)])) as T;
  return x;
}

export async function loadFundamentals(ticker: string) {
  const hit = await lookupCik(ticker);
  if (!hit) throw new Error(`${ticker} is not in the SEC ticker list`);
  const retrievedAt = new Date().toISOString();
  const [cf, sub] = await Promise.all([companyFacts(hit.cik), submissions(hit.cik)]);
  const fundamentals = extractFundamentals(cf, ticker, retrievedAt);
  if (fundamentals.fiscalYears.length < 3) throw new Error(`${ticker} has fewer than three annual 10-K revenue values in EDGAR`);
  const company = extractProfile(sub, ticker, retrievedAt, governanceSince(retrievedAt));
  return { fundamentals, company };
}

function missingRevenue(f: Fundamentals) {
  return f.metrics.revenue.some((x) => x.value === null) || f.metrics.opIncome.at(-1)?.value == null;
}

/**
 * Live run: SEC EDGAR + quote + Claude (assumptions, then prose) + dcf.py.
 * Any failure, or no ANTHROPIC_API_KEY, returns the bundled SAMPLE with the reason.
 */
export async function research(rawTicker: string, origin: string): Promise<ResearchRun> {
  const ticker = rawTicker.trim().toUpperCase();
  if (!TICKER_RE.test(ticker)) return sampleRun(`"${rawTicker}" is not a US ticker. Showing the SAMPLE run.`);
  if (!liveAvailable()) {
    return sampleRun(
      ticker === SAMPLE_TICKER
        ? null
        : `Live runs need ANTHROPIC_API_KEY on the server. Showing the SAMPLE run (${SAMPLE_TICKER}, cached EDGAR) instead of ${ticker}.`,
    );
  }
  try {
    const [{ fundamentals, company }, quote] = await Promise.all([loadFundamentals(ticker), fetchQuote(ticker)]);
    if (quote.price.value === null) throw new Error(`price not obtained (${quote.price.note})`);
    if (missingRevenue(fundamentals)) throw new Error("revenue or operating income not obtained from 10-K data");
    const quality = gradeEarningsQuality(fundamentals, company);
    const defaults = defaultInputs(fundamentals);
    const inputs = sanitizeInputs(scrub(await proposeInputs(fundamentals, company, quote, quality, defaults)));
    const { config } = buildConfig(fundamentals, quote, inputs);
    const valuation = await runDcf(config, origin);
    const narrative: Narrative = scrub(await writeNarrative(fundamentals, company, quote, quality, inputs, valuation));
    return {
      mode: "live",
      generatedAt: new Date().toISOString(),
      notice: null,
      narrativeSource: `Claude ${MODEL}`,
      company,
      quote,
      fundamentals,
      quality,
      inputs,
      assumptions: config,
      valuation,
      narrative,
    };
  } catch (e) {
    return sampleRun(`Live run for ${ticker} failed (${(e as Error).message}). Showing the SAMPLE run instead.`);
  }
}
