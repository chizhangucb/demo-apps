# cutaway-lab

The cutaway skill's three official objects running live in three.js, plus a best-effort Live path. See `PLAN.md` (the plan this was built from) and `README.md`.

- Bun for everything: `bun install && bun run dev`, `bun test`, `bun run lint`, `bun run build`.
- This is Next.js 16. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next code. `agentRules: false` in `next.config.ts` stops `next dev` from rewriting this file.
- `src/vendor/cutaway/` is upstream at commit 5d8f1c6, verbatim. Do not edit it; adapt in `src/engine/official.js`.
- Playback is `src/lib/player.ts` (pure, tested). Tours stay pure functions of tour time.
- Live returns a `ModelSpec` (data, `src/lib/modelspec.ts`), validated on server and client. Never eval or `new Function` model output.
- A preset must never be labelled LIVE, and a Live failure must never show a preset as if it were the Live result.
- `?capture` runs the page on a virtual clock (`window.__labCapture.tick(dt)`) for frame-by-frame recording; `?lite` lowers render quality; `?nolive` forces the Live-unavailable state.
- No em dashes or en dashes in authored UI copy, docs or comments.
