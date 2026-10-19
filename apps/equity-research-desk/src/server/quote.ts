import "server-only";
import type { Quote } from "@/lib/types";

const notObtained = (note: string) => ({ value: null, source: null, asOf: null, note });

/** Last price and 52 week range from the public Yahoo Finance chart endpoint. Missing on any failure. */
export async function fetchQuote(ticker: string): Promise<Quote> {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1d`, {
      headers: { "User-Agent": "Mozilla/5.0 (EquityResearchDesk demo)" },
      signal: AbortSignal.timeout(5_000),
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(String(res.status));
    const meta = (await res.json()).chart.result[0].meta;
    const asOf = new Date(meta.regularMarketTime * 1000).toISOString();
    const src = "Yahoo Finance chart API";
    return {
      price: { value: meta.regularMarketPrice, source: src, asOf, detail: `${meta.symbol} ${meta.currency} last price` },
      low52: { value: meta.fiftyTwoWeekLow ?? null, source: src, asOf },
      high52: { value: meta.fiftyTwoWeekHigh ?? null, source: src, asOf },
    };
  } catch (e) {
    const note = `Quote request failed (${(e as Error).message})`;
    return { price: notObtained(note), low52: notObtained(note), high52: notObtained(note) };
  }
}
