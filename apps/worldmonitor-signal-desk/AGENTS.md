# worldmonitor-signal-desk

Simulated paper trading signal desk dashboard. See `PLAN.md` (the plan this was built from) and `README.md`.

- Bun for everything: `bun install && bun run dev`, `bun test`, `bun run lint`, `bun run typecheck`.
- This is Next.js 16 with breaking changes from older versions. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next code. `agentRules: false` in `next.config.ts` stops `next dev` from rewriting this file.
- The simulation in `src/lib/sim.ts` is pure TypeScript with a seeded PRNG and no React or Next imports; keep it deterministic and add a test in `tests/sim.test.ts` for any change.
- The interface follows the PLAN interface spec (dark terminal dashboard with the live global event feed map). Do not swap it for the usual header plus panel plus card grid layout.
- World geometry is bundled (`src/data/land-110m.json`, Natural Earth 110m via world-atlas). No network at runtime in the default path.
- Paper trading only. All numbers are illustrative. No real orders, wallets or exchange keys.
- No em dashes or en dashes in any file or UI copy.
