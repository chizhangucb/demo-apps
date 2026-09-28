# agentrun-support-triage

## Goal
Single-user **AgentRun support-triage studio**: a sticky Next.js demo of an AgentRun-style workflow (tool search → Jev judge → optional agent investigate → escalate) with a visual step graph and run trace — inspired by [Parcha-ai/agentrun](https://github.com/Parcha-ai/agentrun) / [agentrun.ai](https://agentrun.ai/), complementary to `jev-inbox-triage` (harness/workflow layer, not another Jev-only UI).

Source bookmark: https://x.com/MiguelriosEN/status/2101029313906987422

## Single-user MVP
- One sticky App Router page: pick a seeded support ticket **or** paste a short ticket description, then **Run workflow**
- Seeded tickets (3–5) under `data/` covering paths: clear auto-resolve, needs investigate, escalate-to-human
- **Scripted / no-key path first**: canned tool results + Jev judgments + agent notes drive the graph and trace with zero network / no API keys (mirrors AgentRun’s scripted demo idea)
- Visual **workflow step graph** (nodes: tool search → Jev judge → optional agent investigate → escalate/resolve) with active/completed/skipped states during a run
- **Run trace** panel: ordered step events (inputs, judge label + confidence, branch taken, agent summary, final disposition)
- Optional **live** path behind env (`TYPESAFE_API_KEY` / Jev + `ANTHROPIC_API_KEY` for investigate agent) via serverless `/api` routes; if keys missing, show a clear degraded banner and stay on scripted mode
- `bun install && bun run dev` from `apps/agentrun-support-triage/` only
- Root `bunfig.toml` with `[install] minimumReleaseAge = 259200` before any install
- **Vercel-ready**: `.env.example`, `vercel.json` mirroring sibling apps; scripted mode works without keys; live keys stay server-side under `/api`
- **Post-merge (human / follow-up, not this build PR):** create Vercel project with Root Directory `apps/agentrun-support-triage/` and add a root README Live demos row: `| App | App directory | Public URL | Notes |`

## Explicitly out of scope
- Replacing or duplicating `jev-inbox-triage` (that app is the Jev decision UI; this one is the AgentRun harness / workflow graph)
- Full Pi extension install, real web search, or production CRM / Zendesk connectors
- Multi-user auth, persistence beyond local session, or workflow authoring IDE
- Vendoring the entire AgentRun monorepo or implementing every DSL node type in v1 — support-triage graph is enough
- Training / fine-tuning models
- Creating a new GitHub repo (build only under this monorepo path)
- Creating the Vercel project or editing root README Live demos in this build PR (parent / human ships after merge)

## Outcome-oriented tasks
1. Scaffold **Next.js (App Router)** with Bun; initialize shadcn/ui (minimalist); write `bunfig.toml` with `minimumReleaseAge = 259200` **before** any install
2. Add `data/` seeded support tickets + scripted run fixtures (tool hits, judge outcomes, agent notes, final dispositions) covering resolve / investigate / escalate
3. Studio UI: ticket chips + paste box + Run → **step graph** + **run trace** + final disposition card; degraded banner when live keys absent
4. Wire scripted runner end-to-end (no API key); optional live `/api` routes only when env present (Jev judge + Anthropic investigate)
5. Prefer `@parcha/agentrun-dsl` / `@parcha/agentrun-jev` when installable and compatible; otherwise ship a thin AgentRun-shaped runner that matches the DSL mental model and document the fallback in README
6. README: how to run, env vars, attribution to https://github.com/Parcha-ai/agentrun and https://agentrun.ai/, bookmark link, note complementarity with `jev-inbox-triage`
7. Validation: at least one screenshot and one short video of the running app (hosted off-repo); link both in the PR; commit no media
8. Move this pick from `proposed` → `built` in `tracking/seen-bookmarks.json` (keep slug `agentrun-support-triage`, id `2101029313906987422`)
9. After merge: Vercel project (root dir `apps/agentrun-support-triage/`) + README Live demos table row (`App | App directory | Public URL | Notes`) — not part of this build PR

## Stack
- Bun — runtime / package manager / scripts (monorepo default per AGENTS.md)
- Next.js (App Router) — sticky demo + easy serverless `/api` for optional live Jev/Anthropic
- shadcn/ui + Tailwind — minimal UI primitives (match sibling demos)
- AgentRun ([Parcha-ai/agentrun](https://github.com/Parcha-ai/agentrun)) — workflow DSL (Jev decisions + agent calls + code); use packages when practical
- Jev / TypeSafe — judge nodes when live keys present
- Anthropic — optional investigate agent node when live keys present
- Vercel — shareable host (`vercel.json`; serverless `/api` for live path)

## Reference
- AgentRun: https://github.com/Parcha-ai/agentrun · https://agentrun.ai/
- Bookmark: https://x.com/MiguelriosEN/status/2101029313906987422
- Sibling (complementary, do not duplicate): `apps/jev-inbox-triage`
- Monorepo build contract: root `AGENTS.md`

## Deferred
- Full AgentRun authoring / Pi extension in-browser
- Real ticket-system connectors and live web search tools
- Multi-workflow gallery beyond support triage
- Cloudflare deploy path
- Saving run history across sessions

---

## Build instruction (Claude Code routine)

Build this demo end-to-end under `apps/agentrun-support-triage/` in the existing GitHub repo **chizhangucb/demo-apps** (do NOT create a new repo). Follow root `AGENTS.md` and this PLAN.md verbatim.

Required outcomes:
1. Implement the MVP in `apps/agentrun-support-triage/` only (Bun + Next.js App Router + shadcn; `bunfig.toml` with `minimumReleaseAge = 259200` before install; `bun install && bun run dev`).
2. Scripted/no-key demo path first: AgentRun-style workflow graph + run trace for support triage (tool search → Jev judge → optional agent investigate → escalate/resolve). Optional live Jev + Anthropic behind env via serverless API; clear degraded banner without keys.
3. Open one PR to `main` on branch `demo-agentrun-support-triage` with a one-paragraph summary plus links to at least one screenshot and one short video (hosted off-repo; commit no media).
4. Update `tracking/seen-bookmarks.json`: move pick id `2101029313906987422` (slug `agentrun-support-triage`) from `proposed` to `built`.
5. Vercel-ready (`.env.example`, `vercel.json`). Attribute AgentRun to https://github.com/Parcha-ai/agentrun and the bookmark https://x.com/MiguelriosEN/status/2101029313906987422. Do **not** create the Vercel project or edit root README Live demos in this PR (post-merge follow-up: Root Directory `apps/agentrun-support-triage/`).
6. Do **not** create a new GitHub repository. Stay inside `apps/agentrun-support-triage/` (plus the bookmark tracking update). Never touch sibling apps.
