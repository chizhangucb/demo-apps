# claude-code-mods

## Goal
Single-user **Claude Code Mods playground**: a sticky Bun/Next.js demo of Anthropic's TypeScript in-process mods — edit a tiny `register(on)` mod, fire sample engine events (e.g. Bash `tool.call`, UI render), and watch **deny / rewrite / pass-through** live — inspired by [Claude Code mods](https://claude.com/blog/claude-code-mods). No Claude Code install required.

Source bookmark: https://x.com/ClaudeDevs/status/2105721434807083061

## Single-user MVP
- One sticky App Router page: **mod editor** (tiny TypeScript `register(on)` snippet) + **event picker** + **Fire event** + live **outcome panel** (deny / rewrite / pass-through) and a short event timeline
- Seed **2–3 starter mods** under `data/` (examples: deny dangerous Bash, rewrite a prompt, pass-through with a UI tweak annotation) so the demo works before the user edits
- Seed **sample engine events** under `data/` (at least: Bash `tool.call`, a permission-style event, a UI render / draw event) that the playground dispatches through a simulated mod middleware chain
- **Scripted / no-key path first**: a local in-browser (or serverless) mod harness evaluates the active mod against the chosen event and shows the result with zero network / no API keys / no Claude Code CLI — so the live Vercel demo works with zero secrets
- Optional **live** path behind env (`ANTHROPIC_API_KEY`) via serverless `/api` only if easy (e.g. ask Anthropic to suggest a mod snippet); keys server-side only; not required for the default demo
- Simulated/local Claude Code–shaped mod engine only — **no** Claude Code binary, plugin marketplace, or real CLI session
- `bun install && bun run dev` from `apps/claude-code-mods/` only
- Root `bunfig.toml` with `[install] minimumReleaseAge = 259200` before any install
- **Vercel-ready**: `.env.example`, `vercel.json` mirroring sibling apps; scripted mode works without keys
- **Finish line (post-merge ship, not this build PR):** live Vercel production URL + root README **Live demos** table row (`App | App directory | Public URL | Notes`)

## Explicitly out of scope
- Installing or requiring the Claude Code CLI / desktop app
- Real plugin marketplace, `/plugin` install flow, or `sec-default` admin policy engine
- Full fidelity of every Claude Code engine event and `$` noun/verb surface — a small event set that demos deny / rewrite / pass-through is enough
- Multi-user auth, persistence beyond local session, or shipping real plugins to Anthropic's directory
- Creating a new GitHub repo (build only under this monorepo path)
- Creating the Vercel project or editing root README Live demos in this build PR (parent / human ships after merge)
- Baking any API keys or `.env` into the tree or build artifacts

## Outcome-oriented tasks
1. Scaffold **Next.js (App Router)** with Bun; initialize shadcn/ui (minimalist); write `bunfig.toml` with `minimumReleaseAge = 259200` **before** any install
2. Add `data/` seeded starter mods + sample engine events (Bash `tool.call`, permission, UI render) with expected deny / rewrite / pass-through fixtures
3. Studio UI: mod editor + starter chips → event picker → Fire → **outcome** (deny / rewrite / pass-through) + event timeline; degraded banner when live keys absent
4. Wire scripted/local mod harness end-to-end (no API key): load `register(on)`-shaped handlers (safe eval sandbox or precompiled fixtures + editable source display — prefer safe fixtures + controlled interpreter over raw `eval` of user text; if user-edited source cannot run safely, fall back to matching a seeded mod and still show the outcome clearly); optional live `/api` only when `ANTHROPIC_API_KEY` present
5. README: how to run, env vars, attribution to Claude Code mods blog + the bookmark, note scripted vs optional live Anthropic path, clarify this is a playground not a Claude Code install
6. Validation: at least one screenshot and one short video of the running app (hosted off-repo); link both in the PR; commit no media
7. Move this pick from `proposed` → `built` in `tracking/seen-bookmarks.json` (keep slug `claude-code-mods`, id `2105721434807083061`)
8. After merge: Vercel project (root dir `apps/claude-code-mods/`) + README Live demos table row (`App | App directory | Public URL | Notes`) — not part of this build PR; finish line = production URL in that table

## Stack
- Bun — runtime / package manager / scripts (monorepo default per AGENTS.md)
- Next.js (App Router) — sticky demo + easy serverless `/api` for optional live Anthropic
- shadcn/ui + Tailwind — minimal UI primitives (match sibling demos)
- Simulated/local Claude Code–shaped mod harness — `register(on)` + middleware-style `next(e)` for deny / rewrite / pass-through (scripted first)
- Anthropic API — optional live “suggest a mod” when `ANTHROPIC_API_KEY` present
- Vercel — shareable host (`vercel.json`; serverless `/api` for live path; scripted path for zero-secret demos)

## Env (document in `.env.example` + README)
- `ANTHROPIC_API_KEY` — optional; enables live suggest-mod `/api` (server-side only). Without it, scripted fixtures + local harness power the demo.
- `ANTHROPIC_WORKSPACE_ID` — optional; same pattern as sibling Anthropic demos when live path is used.
- Do **not** require secrets for the default Vercel production demo path.

## Reference
- Claude Code mods: https://claude.com/blog/claude-code-mods
- Getting started: https://claude.dev/blog/getting-started-with-claude-code-mods/
- Bookmark: https://x.com/ClaudeDevs/status/2105721434807083061
- Monorepo build contract: root `AGENTS.md`

## Deferred
- Real Claude Code CLI / plugin hot-reload integration
- Full `$` engine surface and admin `sec-default` policy simulation
- Multi-mod stack ordering playground beyond a single active mod
- Cloudflare deploy path
- Exporting a real `.claude-plugin` package from the playground

---

## Build instruction (Claude Code routine)

Build this demo end-to-end under `apps/claude-code-mods/` in the existing GitHub repo **chizhangucb/demo-apps** (do NOT create a new repo). Follow root `AGENTS.md` and this PLAN.md verbatim.

**Angle (must ship):** Single-user Next/Bun Vercel playground for Claude Code mods. User edits a tiny `register(on)` mod, fires sample engine events (Bash `tool.call`, UI render), and watches deny / rewrite / pass-through live. No Claude Code install needed. Seed starter mods + sample events under `data/`. Simulated/local mod harness only. Scripted/no-key path first so Vercel demo works without secrets; optional live Anthropic behind env via serverless `/api` if easy (same env pattern as sibling demos). Finish line after merge = live Vercel production URL in root README Live demos table (do **not** invent URLs or edit that table in this build PR).

Required outcomes:
1. Implement the MVP in `apps/claude-code-mods/` only (Bun + Next.js App Router + shadcn; `bunfig.toml` with `minimumReleaseAge = 259200` before install; `bun install && bun run dev`).
2. Scripted/no-key demo path first: mod editor + event fire → deny / rewrite / pass-through outcome + timeline. Optional live Anthropic behind env via serverless `/api`; clear degraded banner without keys. No Claude Code CLI / plugin runtime.
3. Open one PR to `main` on branch `demo-claude-code-mods` with a one-paragraph summary plus links to at least one screenshot and one short video (hosted off-repo; commit no media).
4. Update `tracking/seen-bookmarks.json`: move pick id `2105721434807083061` (slug `claude-code-mods`) from `proposed` to `built`.
5. Vercel-ready (`.env.example`, `vercel.json`). Attribute Claude Code mods (https://claude.com/blog/claude-code-mods) and the bookmark https://x.com/ClaudeDevs/status/2105721434807083061. Do **not** create the Vercel project or edit root README Live demos in this PR (post-merge ship: Root Directory `apps/claude-code-mods/`; finish line = production URL in Live demos).
6. Do **not** create a new GitHub repository. Stay inside `apps/claude-code-mods/` (plus the bookmark tracking update). Never touch sibling apps.
