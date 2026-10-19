import { gradeEarningsQuality } from "@/lib/quality";
import { sampleRun } from "@/lib/sample";
import { loadFundamentals, TICKER_RE } from "@/server/research";

/** GET /api/edgar?ticker=AAPL: parsed 10-K fundamentals, governance filings and the quality grade. */
export async function GET(req: Request) {
  const ticker = (new URL(req.url).searchParams.get("ticker") ?? "").trim().toUpperCase();
  try {
    if (!TICKER_RE.test(ticker)) throw new Error("bad ticker");
    const { fundamentals, company } = await loadFundamentals(ticker);
    return Response.json({ mode: "live", fundamentals, company, quality: gradeEarningsQuality(fundamentals, company) });
  } catch (e) {
    const s = sampleRun();
    return Response.json({ mode: "sample", error: (e as Error).message, fundamentals: s.fundamentals, company: s.company, quality: s.quality });
  }
}
