# weight-space-lab

Base Qwen3.5-0.8B vs its weight-edited checkpoint. See `PLAN.md` (the plan this was built from) and `README.md`.

- Bun for everything: `bun install && bun run dev`, `bun test`, `bun run lint`, `bun run typecheck`, `bun run build`.
- This is Next.js 16 with breaking changes from older versions. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next code. `agentRules: false` in `next.config.ts` stops `next dev` from rewriting this file.
- All evidence lives in `public/data/` and is fetched by path. Never edit those files; model output text stays verbatim (display may trim trailing whitespace only).
- `src/lib/bf16.ts` decodes the sparse edit: `idx` is flat row-major, `val` is uint16 bfloat16, value = float32 of `(val << 16)`. The diff has no base weights; never invent them.
- Published numbers outside the JSON live in `src/lib/sources.ts` with their URL. Author results and the Hugging Face re-run must stay in separate tables.
- Live mode is a best-effort server-side call to a third-party Space (`src/server/space.ts`). It must never be labelled as recorded, and recordings must never be labelled live. `HF_TOKEN` stays server-side.
- No em dashes or en dashes in authored UI copy, docs or comments.
