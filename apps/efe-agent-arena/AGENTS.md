# efe-agent-arena

A scoreboard of published Embodied First Exam (EFE) core results. See `PLAN.md` (the plan this was built from) and `README.md`.

- Bun for everything: `bun install && bun run dev`, `bun test`, `bun run lint`, `bun run typecheck`, `bun run build`.
- This is Next.js 16. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next code. `agentRules: false` in `next.config.ts` stops `next dev` from rewriting this file.
- All results live in `src/data/core-results.json` and `src/data/aggregates.json`, copied verbatim from `PLAN-data/` (official snapshot vendored 2026-11-25). Never invent a score, a per-test mark, or a per-task RoboDojo prompt matrix. Never rank GPT-6 Luna (core_off).
- `src/lib/score.ts` holds the pure scoring logic (setting filters, the Overall all-modes task rule, pair diffs, suite leaders with ties, RoboDojo prompt lookup). `tests/score.test.ts` checks it against the official view totals.
- No server route, no live scrape, no Harbor, no simulator, no model calls, no secrets, no env vars.
- No em dashes or en dashes in authored UI copy, docs or comments.
