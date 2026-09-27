# archify-system-map

## Goal
Single-user **system map studio**: pick a seeded stack or paste a short system description, produce typed Archify JSON IR, and open a polished interactive HTML architecture map — inspired by [tt-a1i/archify](https://github.com/tt-a1i/archify) (MIT), without requiring a live LLM API key for the default demo path.

Source bookmark: https://x.com/ungetsuli/status/2092801435398553622

## Single-user MVP
- One-page studio (Vite SPA): seed-stack chips **or** a paste-description textarea
- Seeded stacks (3–5): e.g. web+Redis+Postgres cache-miss, CI/CD workflow, agent tool-call loop, simple data pipeline — each with a checked-in sample IR JSON under `data/`
- **Sample IR without API key**: loading a seed (or a canned paste match) renders immediately from local IR; no network required for the happy path
- Optional “generate / refine” path behind env (`ANTHROPIC_API_KEY` or similar) that asks a model to emit Archify-shaped IR; if missing, show a clear degraded banner and stay on samples
- Compile / embed interactive HTML: prefer Archify’s Node renderer / CLI (`tt-a1i/archify`) when installable; otherwise ship a thin viewer that loads validated IR + a self-contained HTML shell so the map is explorable (focus, theme, present-style controls as feasible)
- Show IR editor (read-only or light edit) beside the preview so the typed source stays visible
- `bun install && bun run dev` from `apps/archify-system-map/` only
- Root `bunfig.toml` with `[install] minimumReleaseAge = 259200` before any install
- **Vercel-ready**: `.env.example`, `vercel.json` mirroring sibling apps; static SPA is enough for sample mode; if a generate API exists, keep keys server-side under `/api`
- **Post-merge (human / follow-up, not this build PR):** create Vercel project with Root Directory `apps/archify-system-map/` and add a root README Live demos row: `| App | App directory | Public URL | Notes |`

## Explicitly out of scope
- Vendoring the full Archify monorepo or reimplementing all five diagram types + delta compare in v1 — **architecture (and optionally one second type)** is enough
- Hosted Archify cloud, account system, or multi-user sharing
- Real git source-evidence pinning / `--repo-root` verification for arbitrary private repos
- WYSIWYG drag-drop diagram editor or Mermaid import
- Training or fine-tuning models
- Creating a new GitHub repo (build only under this monorepo path)

## Outcome-oriented tasks
1. Scaffold Vite + React with Bun; initialize shadcn/ui (minimalist); write `bunfig.toml` first
2. Add `data/` sample IR JSON for each seed stack (architecture schema-shaped; keep small and valid)
3. Studio UI: seed chips + paste box + “Render map” → preview pane (iframe or embedded HTML) + IR panel
4. Wire sample path (no API key) end-to-end; optional generate API route only if env present
5. Integrate Archify render/validate when practical (`npx`/`node` against published skill packages or vendored minimal render helpers); document fallback
6. README: how to run, env vars, MIT attribution to https://github.com/tt-a1i/archify, bookmark link
7. Validation: at least one screenshot and one short video of the running app (hosted off-repo); link both in the PR; commit no media
8. Move this pick from `proposed` → `built` in `tracking/seen-bookmarks.json` (keep slug `archify-system-map`)
9. After merge: Vercel project (root dir `apps/archify-system-map/`) + README Live demos table row (`App | App directory | Public URL | Notes`)

## Stack
- Bun — runtime / package manager / scripts (monorepo default per AGENTS.md)
- Vite + React — light SPA, matches sibling demos
- shadcn/ui + Tailwind — minimal UI primitives
- Archify ([tt-a1i/archify](https://github.com/tt-a1i/archify)) — typed JSON IR → interactive HTML system maps
- Vercel — shareable host (`vercel.json`; serverless `/api` only if generate path needs a key)

## Reference
- Archify: https://github.com/tt-a1i/archify (MIT)
- Bookmark: https://x.com/ungetsuli/status/2092801435398553622
- Monorepo build contract: root `AGENTS.md`

## Deferred
- Full five-type gallery (workflow / sequence / dataflow / lifecycle) UI
- Architecture Delta before/after compare
- Live repo clone + source-evidence pins
- Cloudflare deploy path
- Multi-file project import

---

## Build instruction (Claude Code routine)

Build this demo end-to-end under `apps/archify-system-map/` in the existing GitHub repo **chizhangucb/demo-apps** (do NOT create a new repo). Follow root `AGENTS.md` and this PLAN.md verbatim.

Required outcomes:
1. Implement the MVP in `apps/archify-system-map/` only (Bun + Vite + React + shadcn; `bunfig.toml` with minimumReleaseAge before install; `bun install && bun run dev`).
2. Open one PR to `main` on branch `demo-archify-system-map` with a one-paragraph summary plus links to at least one screenshot and one short video (hosted off-repo; commit no media).
3. Update `tracking/seen-bookmarks.json`: move pick id `2092801435398553622` (slug `archify-system-map`) from `proposed` to `built`.
4. Vercel-ready (`.env.example`, `vercel.json`). Attribute MIT to https://github.com/tt-a1i/archify and the bookmark https://x.com/ungetsuli/status/2092801435398553622.
5. Do **not** create a new GitHub repository. Stay inside `apps/archify-system-map/` (plus the bookmark tracking update).
