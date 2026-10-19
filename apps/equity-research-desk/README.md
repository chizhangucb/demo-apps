# Equity Research Desk

Type a US ticker, get an institutional-style single-stock report: real numbers from SEC EDGAR, valuations computed by the equity-research skill's own `scripts/dcf.py`, an earnings quality grade that can veto a buy, and the skill's nine chapters. Every figure carries a source tag and a timestamp; anything without a source says "not obtained".

**Not investment advice.** This demo shows a research workflow. The action is the output of fixed rules, not a recommendation, and nothing here places trades.

## Run

```bash
bun install && bun run dev
```

Open http://localhost:3000. Python 3 must be on the PATH for the local valuation path (`python3`, standard library only).

Checks: `bun test`, `bun run lint`, `bun run typecheck`, `bun run build`.

## What you see

- **Header**: ticker input, SAMPLE or LIVE badge, data cutoff, "Not investment advice".
- **Earnings quality and action**: the A to D grade badge, the failing checks, the decision triad (intrinsic value, next 1 to 3 months, action). Grade C caps the action at wait and see; grade D is always avoid. With C or D the Buy button is struck through and disabled, with the veto reason.
- **Football field**: market 52 week range, scenario DCF, WACC x g sensitivity, EPV, EVA, Monte Carlo P10 to P90, relative valuation ("not obtained" unless sourced), and the composite range, with the current price marked.
- **Priced in vs our view**: reverse DCF implied revenue CAGR and steady FCF, PVGO share of price, value per share and earnings quality, each with a falsifier.
- **Nine chapters** (tabs) plus a sources appendix.
- **Assumptions and dcf.py provenance**: the assumptions JSON (editable, downloadable, re-runnable through dcf.py) and the raw dcf.py transcript (upstream prints in Chinese).

## What is real, what is simulated

| Piece | SAMPLE (default, zero secrets) | LIVE (needs `ANTHROPIC_API_KEY`) |
| --- | --- | --- |
| Financials | Cached excerpt of SEC EDGAR companyfacts for SMCI, retrieved 2026-10-19 (`data/sample/`) | SEC EDGAR companyfacts + submissions, fetched now (8 s timeout, 6 h cache) |
| Price | Cached Yahoo Finance chart quote | Yahoo Finance chart endpoint (5 s timeout) |
| Earnings quality | Fixed rules on the filed numbers | Same rules |
| Assumptions | Scripted defaults (`src/lib/assumptions.ts`) | Claude sets the judgment knobs; the app expands them into a dcf.py config |
| Valuations | Precomputed with the same dcf.py (`scripts/build-sample.ts`) | dcf.py at request time |
| Prose | Scripted sample analyst text | Claude, told to use only the supplied data |

The SAMPLE is labelled SAMPLE throughout. Without a key, any ticker shows the SAMPLE with a notice; any live failure (unknown ticker, SEC or quote timeout, Claude error) also falls back to the SAMPLE with the reason. `GET /api/edgar?ticker=AAPL` works without a key and returns the parsed 10-K data and grade.

The SMCI sample is a good stress case: its FY2026 10-K shows $2.23B net income against negative $6.81B operating cash flow, inventory and receivables growing faster than revenue, and 2024 to 2025 auditor change, late filing and listing notices in the submissions index, so it grades D and the buy is vetoed. SG&A is not tagged in its filings, so the Beneish M-Score shows "not obtained".

## How it works

- `src/lib/edgar.ts` reads 10-K annual facts (XBRL concepts tried in order) and governance filings (8-K items 4.01, 4.02, 3.01, NT filings).
- `src/lib/quality.ts` grades: cash conversion, Sloan accruals, receivables and inventory vs revenue, stock comp, governance filings, and the Beneish M-Score when all eight inputs exist.
- `src/lib/assumptions.ts` turns judgment knobs (WACC, terminal growth, three scenarios) into a full dcf.py config: scenarios, sensitivity, reverse DCF, PVGO, EPV, EVA, Monte Carlo.
- `python/dcf.py` is the vendored upstream script, unchanged. `python/runner.py` imports it, runs the full CLI flow for the transcript and returns the numbers as JSON.
- `POST /api/value` runs the runner with a local `python3`. On Vercel, where the Node function has no Python, it calls the Python function `api/dcf.py` (`/api/dcf`) that wraps the same runner.
- `POST /api/research` is the live pipeline: EDGAR, quote, grade, Claude assumptions, dcf.py, Claude prose. `skill/SKILL.condensed.md` and `skill/assumptions.schema.json` hold the condensed skill and the schema Claude fills.
- SEC requests send a User-Agent naming the app (`src/server/sec.ts`); put your own contact address there when you deploy, per the SEC fair access policy.

Not built (out of scope in the PLAN): HK and A-share listings, PDF export, the 20 industry appendices, running `check_research_output.py`, peer multiples from paid vendors.

## Env

None required. See `.env.example`: `ANTHROPIC_API_KEY`, `ANTHROPIC_WORKSPACE_ID`, `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`), `ANTHROPIC_EFFORT` (default `low`). All server side only. Vercel Root Directory: `apps/equity-research-desk`.

## Attribution

- Skill, method and `scripts/dcf.py`: [rollingSirius/equity-research-skill](https://github.com/rollingSirius/equity-research-skill) by [@rollingSirius](https://x.com/rollingSirius), MIT License. The license text ships at `python/LICENSE-equity-research-skill`.
- Idea: [@rollingSirius on X](https://x.com/rollingSirius/status/2078081213961851252).
- Data: SEC EDGAR public APIs (companyfacts, submissions, company tickers). Price: Yahoo Finance chart endpoint (unofficial, best effort).
