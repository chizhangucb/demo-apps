# magpie-routing-groups

Simulated playground for magpie routing groups. See `PLAN.md` (the plan this was built from) and `README.md`.

- Bun for everything: `bun install && bun run dev`, `bun test`, `bun run lint`, `bun run typecheck`.
- This is Next.js 16 with breaking changes from older versions. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next code. `agentRules: false` in `next.config.ts` stops `next dev` from rewriting this file.
- The routing engine in `src/lib/routing/` is pure TypeScript with no React or Next imports; keep it that way and add a test in `tests/routing.test.ts` for any rule change.
- Mode names and pick steps follow magpie's docs. Label anything else as illustrative in the UI and README.
- Zero secrets by default. Optional env uses the names in `.env.example` only, read server-side.
- No em dashes or en dashes in any file or UI copy.
