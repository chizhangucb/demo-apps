# starvla-composer

A composer for official StarVLA combos (backbone, action head, training recipe, benchmark). See `PLAN.md` (the plan this was built from) and `README.md`.

- Bun for everything: `bun install && bun run dev`, `bun test`, `bun run lint`, `bun run typecheck`, `bun run build`.
- This is Next.js 16. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next code. `agentRules: false` in `next.config.ts` stops `next dev` from rewriting this file.
- All facts live in `src/lib/data.ts`, copied from PLAN.md (fetched 2026-11-24). Never invent a score or a Hugging Face id. When two official tables disagree, show both with sources.
- `src/lib/resolve.ts` is the deterministic support resolver; `src/lib/sim.ts` is the schematic animation state. Both are unit tested in `tests/`.
- `/api/hub` is the only server route: public Hugging Face Hub API, vendored ids only, 8 s timeout, one attempt, per-IP cooldown. It must never pretend vendored data is live.
- No model weights, no policy server, no GPU or WebGPU inference, no secrets, no env vars.
- No em dashes or en dashes in authored UI copy, docs or comments.
