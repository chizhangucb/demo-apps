# claude-agent-loops

## Goal
Single-user **Claude Agent Loops** studio: a sticky Bun/Next.js demo of Claude Code–style agent loop patterns (turn / goal / time / proactive) with a live Act → Evaluate → Continue/Stop timeline, turns/budget scoreboard, and Done badge — inspired by Anthropic’s Claude agent loop primitives.

Source bookmark: https://x.com/ClaudeDevs/status/2074208949205881033

## Single-user MVP
- One sticky App Router page: pick a **loop type** (turn / goal / time / proactive), set **goal** + **verification criteria** + **max turns / budget**, then **Run**
- **Timeline** shows Act → Evaluate → Continue/Stop with live turns/budget scoreboard and a **Done** badge when the loop stops
- Seed **2–3 canned tasks** under `data/` (e.g. refine landing copy; poll a fake deploy until green; one more short loop-friendly task)
- **Scripted / no-key path first**: simulated/local loop harness with canned act/evaluate steps so the live Vercel demo works with zero secrets (clear degraded banner when live keys absent)
- Optional **live** path behind env (`ANTHROPIC_API_KEY`) via serverless `/api` if easy — keys server-side only; not required for the default demo
- Simulated/local loop harness only — **no** Claude Code `/goal`/`/loop` CLI integration required
- `bun install && bun run dev` from `apps/claude-agent-loops/` only
- Root `bunfig.toml` with `[install] minimumReleaseAge = 259200` before any install
- **Vercel-ready**: `.env.example`, `vercel.json` mirroring sibling apps; scripted mode works without keys
- **Finish line (post-merge ship, not this build PR):** live Vercel production URL + root README **Live demos** table row (`App | App directory | Public URL | Notes`)

## Explicitly out of scope
- Claude Code `/goal` or `/loop` CLI/runtime integration
- Multi-user auth, persistence beyond local session, or a runs database
- Training / fine-tuning models
- Creating a new GitHub repo (build only under this monorepo path)
- Creating the Vercel project or editing root README Live demos in this build PR (parent / human ships after merge)
- Baking any API keys or `.env` into the tree or build artifacts

## Outcome-oriented tasks
1. Scaffold **Next.js (App Router)** with Bun; initialize shadcn/ui (minimalist); write `bunfig.toml` with `minimumReleaseAge = 259200` **before** any install
2. Add `data/` seeded tasks + scripted loop fixtures covering turn / goal / time / proactive paths (act steps, evaluate outcomes, continue/stop decisions, budget ticks)
3. Studio UI: loop-type picker + goal / verification / max-turns-or-budget controls → Run → **timeline** (Act → Evaluate → Continue/Stop) + **turns/budget scoreboard** + **Done** badge; degraded banner when live keys absent
4. Wire scripted/local loop harness end-to-end (no API key); optional live `/api` loop step only when `ANTHROPIC_API_KEY` present
5. README: how to run, env vars, attribution to the bookmark, note scripted vs optional live Anthropic path
6. Validation: at least one screenshot and one short video of the running app (hosted off-repo); link both in the PR; commit no media
7. Move this pick from `proposed` → `built` in `tracking/seen-bookmarks.json` (keep slug `claude-agent-loops`, id `2074208949205881033`)
8. After merge: Vercel project (root dir `apps/claude-agent-loops/`) + README Live demos table row (`App | App directory | Public URL | Notes`) — not part of this build PR; finish line = production URL in that table

## Stack
- Bun — runtime / package manager / scripts (monorepo default per AGENTS.md)
- Next.js (App Router) — sticky demo + easy serverless `/api` for optional live Anthropic
- shadcn/ui + Tailwind — minimal UI primitives (match sibling demos)
- Simulated/local loop harness — Act → Evaluate → Continue/Stop (scripted first)
- Anthropic API — optional live evaluate/act steps when `ANTHROPIC_API_KEY` present
- Vercel — shareable host (`vercel.json`; serverless `/api` for live path; scripted path for zero-secret demos)

## Env (document in `.env.example` + README)
- `ANTHROPIC_API_KEY` — optional; enables live loop steps via `/api` (server-side only). Without it, scripted fixtures power the demo.
- Do **not** require secrets for the default Vercel production demo path.

## Reference
- Bookmark: https://x.com/ClaudeDevs/status/2074208949205881033
- Monorepo build contract: root `AGENTS.md`

## Deferred
- Real Claude Code `/goal`/`/loop` integration
- Multi-agent / multi-user loop orchestration
- Cloudflare deploy path
- Saving run history across sessions
- Custom user-authored loop graphs beyond the four types

---

## Build instruction (Claude Code routine)

Build this demo end-to-end under `apps/claude-agent-loops/` in the existing GitHub repo **chizhangucb/demo-apps** (do NOT create a new repo). Follow root `AGENTS.md` and this PLAN.md verbatim.

**Angle (must ship):** Single-user Next/Bun app. User picks a loop type (turn / goal / time / proactive), sets goal + verification criteria + max turns/budget, hits Run. Timeline shows Act → Evaluate → Continue/Stop with live turns/budget scoreboard and Done badge. Seed 2–3 canned tasks (e.g. refine landing copy; poll a fake deploy until green). Simulated/local loop harness only — no Claude Code `/goal`/`/loop` integration required. Scripted/no-key path first so Vercel demo works without secrets; optional live Anthropic behind env via serverless `/api` if easy. Finish line after merge = live Vercel production URL in root README Live demos table (do **not** invent URLs or edit that table in this build PR).

Required outcomes:
1. Implement the MVP in `apps/claude-agent-loops/` only (Bun + Next.js App Router + shadcn; `bunfig.toml` with `minimumReleaseAge = 259200` before install; `bun install && bun run dev`).
2. Scripted/no-key demo path first: loop-type picker + goal/verification/budget → timeline Act → Evaluate → Continue/Stop + turns/budget scoreboard + Done badge. Optional live Anthropic behind env via serverless `/api`; clear degraded banner without keys. No Claude Code CLI `/goal`/`/loop` integration.
3. Open one PR to `main` on branch `demo-claude-agent-loops` with a one-paragraph summary plus links to at least one screenshot and one short video (hosted off-repo; commit no media).
4. Update `tracking/seen-bookmarks.json`: move pick id `2074208949205881033` (slug `claude-agent-loops`) from `proposed` to `built`.
5. Vercel-ready (`.env.example`, `vercel.json`). Attribute the bookmark. Do **not** create the Vercel project or edit root README Live demos in this PR (post-merge ship: Root Directory `apps/claude-agent-loops/`; finish line = production URL in Live demos).
6. Do **not** create a new GitHub repository. Stay inside `apps/claude-agent-loops/` (plus the bookmark tracking update). Never touch sibling apps.
