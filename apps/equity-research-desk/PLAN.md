# Equity Research Desk: PLAN

## Goal

A single-user Next.js + Bun playground on Vercel that runs the open-source [equity-research-skill](https://github.com/rollingSirius/equity-research-skill) (MIT, @rollingSirius) as an interactive desk: the user types a US ticker, the app pulls real public company facts from the SEC EDGAR company facts API (no key), Claude (Sonnet) follows the skill, and the valuations defined by the skill (DCF, reverse DCF, EPV, EVA) run through a copy of `scripts/dcf.py` in a serverless Python function with assumptions saved and shown as JSON. The page shows a football field chart of valuation ranges, a priced-in versus our-view table, an earnings quality grade A to D (C or D blocks any buy call, visibly), and a report view of the skill's nine chapters. Every figure has a source tag and timestamp; anything unsourced shows "not obtained". A scripted sample ticker run from bundled cached EDGAR data keeps the page useful with zero secrets.

Source: bookmark https://x.com/rollingSirius/status/2078081213961851252, repo https://github.com/rollingSirius/equity-research-skill.

If any link fails to load, use the Background summary below and do not search elsewhere.

## Background (embedded summary of the skill README, SKILL.md and scripts/dcf.py)

What it is: an agent skill that turns a single-stock research request into an institutional-style deep report that is fact-traceable, valuation-reproducible and conclusion-auditable. MIT licensed. Author @rollingSirius. Sample reports in `Example/` (NVDA, GOOGL). Covers US, HK and A-shares (this demo is US only).

Discipline (from SKILL.md):
- Separate facts from judgments ("My view").
- Every key number carries a source and a timestamp. Conflicting data is reconciled. Missing data is written as "not obtained" (English) or "未获取到" (Chinese). Never fill gaps from memory.
- Expectations gap first: what the market has priced in vs an independent view, with a falsifiable thesis. No independent view, no buy/sell action.
- Separate intrinsic value, near-term market direction (1 to 3 months) and the investment action.
- Earnings quality before valuation. Grades C or D veto a buy.
- Valuations are never mental math: all methods run through `scripts/dcf.py` with assumptions filed as JSON.
- The skill is not a licensed advisor; the user owns the decision. The skill does not execute trades.

Six-step workflow:
0. Confirm company, ticker, listing, currency, report language.
1. Gather data by source tier (filings first). Pick one primary industry appendix from `industries/` (20 industries) after reading `references/industry-routing.md`.
2. Reconcile, timestamp, run the earnings-quality review (`references/forensic-accounting.md`): accrual quality, Beneish M-Score, revenue-recognition red flags, capitalization, governance → grade A/B/C/D. C caps action at wait and see; D is always avoid.
3. Write the report from `references/report-template.md` nine chapters and `references/output-format.md` (conclusion box, Tearsheet, Gap table, football field).
4. Valuation: at least three methods, in order reverse DCF + PVGO, three-scenario probability-weighted DCF (optional Monte Carlo), EPV / three-factor (Greenwald), EVA / residual income, then relative / SOTP as needed. All via `scripts/dcf.py`. Run `scripts/check_research_output.py` before shipping.
4.5. Counter-case and pre-mortem (required). Independent view three questions; if unanswered, action becomes wait and see.
5. Deliver the report only (default PDF from Markdown). Assumptions JSON and script output stay internal unless the user asks.

Nine chapters (English titles): 1 Executive Summary (decision triad, Gap table, falsifiers); 2 Business Overview; 3 Business and Competitive Analysis; 4 Management, Governance, and Capital Allocation; 5 Financial Analysis and Earnings Quality; 6 Valuation; 7 Analyst View Summary; 8 Recent News and Catalysts; 9 Investment Conclusion, Counter-Case, and Position Sizing; plus an appendix of sources and timestamps.

`scripts/dcf.py` (CLI: `--config assumptions.json` or `--demo`):
- Inputs (JSON): `price`, `shares`, `net_debt`, `wacc`, `terminal_g`, `scenarios` (bear/base/bull with `prob`, `revenue[]`, `fcf_margin[]`, fade fields), optional `sensitivity`, `reverse` (interim_fcf, steady_margins, base_revenue), `pvgo`, `epv`, `eva`, `montecarlo`, `range_low`, `range_high`.
- Outputs: per-scenario EV and per-share value, TV share warning if TV > 80%, probability-weighted fair value, WACC×g sensitivity grid, reverse DCF implied steady FCF and revenue, PVGO split, EPV and franchise growth, EVA / residual income, optional Monte Carlo P10-P90, position sizing helpers, and a calibrate label from price vs [range_low, range_high].
- The demo must vendor a copy of this script under the app (do not call the upstream repo at runtime) and keep its behavior.

Football field (from `references/output-format.md`): a chart of method ranges (reverse DCF / market implied, scenario-weighted DCF, EPV, relative, EVA) with a composite interval and the current price marked. The skill draws it in monospace; this app should render it as a real horizontal range chart.

## Single-user MVP

1. Ticker input: a US ticker field and a Run button. Default to a sample ticker (for example AAPL or NVDA) so the first paint is never empty.
2. Data: server route that fetches SEC EDGAR companyfacts (`https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json`) with a proper User-Agent per SEC policy (identify the app and a contact email). Map CIK via the SEC ticker JSON. Cache responses. On any failure, or when no `ANTHROPIC_API_KEY` is set, fall back to a bundled cached EDGAR snapshot for one sample ticker under `data/sample/`, clearly labelled "SAMPLE (cached EDGAR)".
3. Claude path (optional live): when `ANTHROPIC_API_KEY` is set (same env names as `apps/claude-agent-loops`: `ANTHROPIC_API_KEY`, `ANTHROPIC_WORKSPACE_ID`, `ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT`, server-side only), call Claude Sonnet with a prompt that follows the skill (vendor a condensed SKILL.md and the valuation JSON schema under the app). Cap tokens and time. On any error, fall back to the scripted sample. Add no new secret names.
4. Valuations: a serverless Python function (Vercel Python runtime or a Bun-spawned `python3` in the route if the platform allows; prefer a dedicated `/api/value` that shells out to the vendored `dcf.py --config`) that takes the assumptions JSON, runs the skill methods (scenario DCF, reverse DCF, EPV, EVA; Monte Carlo optional and capped), and returns structured numbers. Persist the assumptions JSON next to the result and show it in a collapsible panel.
5. Page sections (all required in the first build; see Acceptance criteria):
   - Header with ticker, company name, report date / data cutoff, SIMULATED or LIVE badge, and a clear "Not investment advice" line.
   - Football field chart of valuation ranges with the current price marked.
   - Priced-in versus our-view table (expectations gap): market implied vs independent view, with the falsifier.
   - Earnings quality grade badge A to D. Grades C and D visibly block any buy call (disable or strike through Buy, show the veto reason).
   - Report view of the nine chapters (tabs or an accordion), each with source tags and timestamps on figures. Any missing figure shows "not obtained".
   - Assumptions JSON viewer and a short "ran via dcf.py" provenance line.
6. No-key scripted path: loads the sample ticker, shows a full polished report (bundled chapter text + precomputed valuation JSON produced by the same dcf.py), labelled SAMPLE throughout. This path must work with zero secrets on Vercel.
7. Look and feel: a research terminal feel (dark or ink-and-paper with monospace figures, sharp borders, a distinctive football field), polished and not a bare text page. Distinct from the usual left-controls-plus-cards demo layout enough that the chart and grade dominate above the fold.

## Acceptance criteria (look and feel; required in the first and every ticket, never deferred)

The first build and every subsequent ticket must satisfy and keep satisfying all of the following. Proof screenshots in the PR artifact must show each item:
1. Football field chart of valuation ranges renders with the current price marked.
2. Every figure that has a value shows a source tag and a timestamp; at least one figure in the sample report shows the literal text "not obtained".
3. Earnings quality grade badge (A to D) is visible; when the sample (or a live run) is grade C or D, any buy action is visibly blocked.
4. Priced-in versus our-view table is visible above or beside the report body.
5. The page has a research-terminal look (not a bare text dump): chart, badge and gap table are above the fold on a desktop viewport.

## Explicitly out of scope

Real brokerage, order placement, non-US listings in v1, PDF export, the full 20 industry appendices as live content (one sample industry is enough), running `check_research_output.py` in CI as a hard gate (nice to have), scraping paid data vendors.

## Tasks

1. Scaffold `apps/equity-research-desk/` with Bun, Next.js App Router, TypeScript, Tailwind, shadcn as needed. `bunfig.toml` with `minimumReleaseAge = 259200` before install.
2. Vendor `scripts/dcf.py` under the app (for example `python/dcf.py`) and a minimal assumptions schema. Unit tests that call it with the script's `--demo` and with a fixture JSON and assert key fields.
3. Bundle `data/sample/` with a cached EDGAR companyfacts excerpt, a sample assumptions JSON, a precomputed valuation result and sample chapter content that includes at least one "not obtained" and a grade that demonstrates the veto.
4. `/api/edgar` (or equivalent) for live SEC fetches with User-Agent, timeout, cache and sample fallback. `/api/value` for dcf.py. `/api/research` for the optional Claude path with caps and fallback.
5. UI per the MVP and Acceptance criteria.
6. README: what is simulated, the not-investment-advice disclaimer, attribution (upstream repo, MIT license, @rollingSirius, the bookmark), how to run, env vars. Commit `.env.example` with a `!.env.example` line in the app `.gitignore`. `vercel.json` as needed for the Python runtime.

## Screenshot proof requirements

In the PR body link a Claude artifact (hosted off-repo; commit no media) with a short video or stills showing: (1) the ticker input with the sample loaded, (2) the full report with the football field chart, grade badge and priced-in versus our-view table, (3) a visible "not obtained" example. Screenshots must show real content, not a blank or loading state.

## Stack and env

Bun, Next.js App Router, TypeScript, Tailwind. Python 3 available on the server for `dcf.py`. Vercel Root Directory `apps/equity-research-desk`. Optional env: `ANTHROPIC_API_KEY`, `ANTHROPIC_WORKSPACE_ID`, `ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT` (prefer Sonnet when set). Zero secrets must work via the sample path.

## Build instructions for the Claude Code routine

Build only in `apps/equity-research-desk/` plus moving tracking id `2078081213961851252` (slug `equity-research-desk`) from `proposed` to `built` in `tracking/seen-bookmarks.json`. Branch `demo-equity-research-desk`, one PR to `main`. Scripted no-key sample path first and complete. Live SEC + Claude only after that, with fallbacks. Follow the Acceptance criteria above; do not defer the football field, source tags, grade badge or gap table. Do not create the Vercel project, do not edit the root README Live demos table, do not create a repo, do not touch sibling apps. Credit the upstream MIT license in the README. No em dashes or en dashes anywhere you write (README, PR body, commits, UI copy, a generated `AGENTS.md`; replace them if a generator adds them). If a link fails, use this PLAN.
