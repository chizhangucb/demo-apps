# equity-research-desk

Single-stock research desk built on the equity-research skill. See `PLAN.md` (the plan this was built from) and `README.md`.

- Bun for everything: `bun install && bun run dev`, `bun test`, `bun run lint`, `bun run typecheck`.
- This is Next.js 16 with breaking changes from older versions. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next code. `agentRules: false` in `next.config.ts` stops `next dev` from rewriting this file.
- `python/dcf.py` is vendored byte for byte from rollingSirius/equity-research-skill (MIT). Do not edit it; put glue in `python/runner.py`.
- Every figure is a `Fact` with source and timestamp. A missing value stays `null` and renders "not obtained". Never fill gaps with guesses.
- The earnings quality grade comes from fixed rules in `src/lib/quality.ts`; grades C and D must keep blocking the Buy action.
- The SAMPLE path (`src/lib/sample.ts`, `data/sample/`) must keep working with zero secrets. Rebuild it with `bun run sample <companyfacts> <submissions> <yahoo-chart> <ISO time>`.
- Keep the football field, grade badge and gap table above the fold on desktop.
- No em dashes or en dashes in any file or UI copy.
