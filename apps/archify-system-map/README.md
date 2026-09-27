# Archify System Map Studio

Single-user studio that turns a seeded stack, an arrow sketch or (optionally) a prose description into **typed Archify JSON IR**, validates it, and renders a polished, explorable **self-contained HTML architecture map** — without needing an LLM API key for the default path.

- Inspired by [tt-a1i/archify](https://github.com/tt-a1i/archify) (MIT) — IR contract (`architecture`, `schema_version: 1`) and visual language.
- Source bookmark: https://x.com/ungetsuli/status/2092801435398553622
- Plan: [PLAN.md](./PLAN.md)

## Run

```bash
cd apps/archify-system-map
bun install && bun run dev
```

Open the printed URL (default http://localhost:5173).

| Script | What it does |
| --- | --- |
| `bun run dev` | Vite dev server + `/api/status` and `/api/generate` middleware |
| `bun run build` | Typecheck + production build to `dist/` |
| `bun run validate` | Validate every sample IR in `data/` and render it once |
| `bun run typecheck:api` | Typecheck the Vercel `/api` functions |
| `bun run lint` | oxlint |

## How it works

1. **Seed stacks** — four checked-in IR files under [`data/`](./data): web + Redis + Postgres cache-miss path, CI/CD workflow, agent tool-call loop, product analytics pipeline. Each has guided views and summary cards. Loading one never touches the network.
2. **Describe a system** — the paste box has two offline paths:
   - an **arrow sketch** (`Browser (React) -> API -> Postgres: SQL`, one edge per line, optional `# Title`) is parsed into IR with component types inferred from names and an automatic layered layout;
   - plain prose is **keyword-matched** to the closest seed (canned match).
3. **Generate / Refine (optional)** — with `ANTHROPIC_API_KEY` set, `/api/generate` asks Claude to emit IR through a forced tool call, then runs the same validator. Without a key the studio shows a sample-mode banner and the buttons stay disabled.
4. **IR panel** — the typed source sits beside the preview. Edits re-validate on every keystroke and re-render as soon as they are valid; diagnostics show the JSON path, message and code (`schema/additional-property`, `ir/unknown-ref`, …).
5. **Preview** — the map is a standalone HTML document in a sandboxed iframe. **Open** pops it into a new tab; **HTML** downloads it. Inside the map: click a node to focus it with its neighbours and see inbound/outbound edges, step through guided views (buttons or ←/→), toggle trace motion and light/dark, scroll to zoom, drag to pan, and **Present** for fullscreen.

### Archify integration and fallback

The PLAN prefers Archify's own Node renderer/CLI. Archify's renderer isn't published to npm; it ships inside the skill folder of the [GitHub repo](https://github.com/tt-a1i/archify/tree/main/archify). This build doesn't vendor that code or run it at build time. It uses the plan's documented fallback instead, a **thin viewer**:

- [`shared/archify.ts`](./shared/archify.ts): TypeScript types for the architecture IR subset, plus a validator. It mirrors the JSON schema's shape and enum rules (`additionalProperties: false`, id pattern, component/variant/side/card enums) and runs Archify's referential checks: unique ids, known endpoints, boundary wraps and view focus.
- [`shared/render.ts`](./shared/render.ts): turns validated IR into one self-contained HTML file with inline SVG, CSS and a small runtime. It handles explicit `pos`/`size`, grid `row`/`col` and automatic layered layout; orthogonal routing that honours `fromSide`/`toSide`/`via`/`labelAt`; the boundaries (`region`, `security-group`); the connection variants `emphasis`, `security` and `dashed`; plus the legend, cards and guided views.

The IR is still Archify-shaped. You can pass sample or generated JSON to the official CLI (`node archify/bin/archify.mjs render architecture <file.json>`) when you want Archify's full renderer, showcase validation or exports.

Only the **architecture** type is implemented, as the plan's out-of-scope list allows. Workflow, sequence, dataflow and lifecycle, and Architecture Delta, are deferred.

## Environment

Copy `.env.example` to `.env`. All keys are read **server-side only**: by the Vite dev middleware locally and by `/api/*` on Vercel.

| Variable | Required | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | no | Enables Generate / Refine. Without it, sample mode. |
| `ANTHROPIC_WORKSPACE_ID` | no | Only for keys not scoped to a single workspace |
| `ANTHROPIC_MODEL` | no | Model override (default `claude-sonnet-5`) |

## Deploy (Vercel)

Create a Vercel project with **Root Directory** `apps/archify-system-map/`. [`vercel.json`](./vercel.json) builds with Bun and serves `dist/` as a static SPA. `api/status.ts` and `api/generate.ts` run as serverless functions, so the key stays on the server. Sample mode needs no environment variables.

## Layout

```
data/            sample IR (one JSON per seed stack)
shared/          IR types + validator, HTML map renderer, API types
server/          Claude generate path (used by Vite dev middleware and /api)
api/             Vercel serverless functions
src/             React studio (shadcn/ui + Tailwind)
scripts/         validate-samples.ts
```

## License / attribution

Archify is © tt-a1i, MIT-licensed: https://github.com/tt-a1i/archify. This demo reuses its IR contract and visual conventions. It is not affiliated with Archify.
