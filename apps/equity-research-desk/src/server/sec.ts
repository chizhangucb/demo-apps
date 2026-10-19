import "server-only";
import type { CompanyFacts, Submissions } from "@/lib/edgar";

// SEC fair access policy: identify the app and a contact in the User-Agent, stay under 10 req/s.
export const SEC_USER_AGENT = "Tech Demos equity-research-desk alex.ea+techdemos@mail.grokbot.com";
const TIMEOUT_MS = 8_000;
const TTL_MS = 6 * 60 * 60 * 1000;

const cache = new Map<string, { at: number; data: unknown }>();

async function secJson<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data as T;
  const res = await fetch(url, {
    headers: { "User-Agent": SEC_USER_AGENT, "Accept-Encoding": "gzip, deflate" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`SEC ${res.status} for ${new URL(url).pathname}`);
  const data = (await res.json()) as T;
  cache.set(url, { at: Date.now(), data });
  return data;
}

export async function lookupCik(ticker: string): Promise<{ cik: string; title: string } | null> {
  const map = await secJson<Record<string, { cik_str: number; ticker: string; title: string }>>("https://www.sec.gov/files/company_tickers.json");
  const t = ticker.toUpperCase();
  const row = Object.values(map).find((r) => r.ticker === t);
  return row ? { cik: String(row.cik_str).padStart(10, "0"), title: row.title } : null;
}

export const companyFacts = (cik: string) => secJson<CompanyFacts>(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`);
export const submissions = (cik: string) => secJson<Submissions>(`https://data.sec.gov/submissions/CIK${cik}.json`);
