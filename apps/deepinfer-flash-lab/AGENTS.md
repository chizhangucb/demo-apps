# deepinfer-flash-lab

DeepSeek-V4.1-Flash lab built around DeepInfer. See `PLAN.md` (the plan this was built from) and `README.md`.

- Bun for everything: `bun install && bun run dev`, `bun test`, `bun run lint`, `bun run typecheck`.
- This is Next.js 16 with breaking changes from older versions. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next code. `agentRules: false` in `next.config.ts` stops `next dev` from rewriting this file.
- Keys stay server-side (`src/server/provider.ts`). `/api/mode` returns mode, provider and model id only.
- The SAMPLE path (`data/samples/`) must keep working with zero secrets. Rebuild replay timings with `bun run samples`.
- Every published number lives in `data/benchmarks.ts` with a `source` URL and renders next to a `Src` link. Do not add numbers that are not in `PLAN.md`.
- The decoding and scheduler explainers are SIMULATION and must stay labelled as such.
- No em dashes or en dashes in any file or UI copy.
