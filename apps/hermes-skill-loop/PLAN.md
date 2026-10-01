# hermes-skill-loop

## Goal
Single-user **Hermes skill-loop studio**: a sticky Bun/Next.js demo of a Hermes Agent–style learning loop — run a canned multi-step task, watch a **skill get extracted**, then **reuse that skill** on a related task — inspired by [Nous Research Hermes Agent](https://github.com/nousresearch/hermes-agent).

Source bookmark: https://x.com/JacquelineSYC19/status/2100262432413528336

## Single-user MVP
- One sticky App Router page: pick a **seeded multi-step task**, hit **Run**, watch the agent timeline (steps + tool/thought events), then see a **skill extraction** card (name, trigger, steps distilled from the run)
- **Reuse path**: after a skill is extracted, pick a **related follow-up task** and Run again — the UI shows the prior skill being applied (highlighted / injected into the run) vs a cold start
- Seed **2–3 canned task pairs** under `data/` (task A → extracted skill → related task B that benefits from the skill)
- **Scripted / no-key path first**: canned run fixtures + skill payloads drive the studio with zero network / no API keys so the live Vercel demo works with zero secrets (clear degraded banner when live keys absent)
- Optional **live** path behind env (`ANTHROPIC_API_KEY`) via serverless `/api` if easy — keys server-side only; not required for the default demo
- Simulated/local Hermes-shaped harness only — **no** full Hermes Agent runtime install or vendoring the Nous monorepo required
- `bun install && bun run dev` from `apps/hermes-skill-loop/` only
- Root `bunfig.toml` with `[install] minimumReleaseAge = 259200` before any install
- **Vercel-ready**: `.env.example`, `vercel.json` mirroring sibling apps; scripted mode works without keys
- **Finish line (post-merge ship, not this build PR):** live Vercel production URL + root README **Live demos** table row (`App | App directory | Public URL | Notes`)

## Explicitly out of scope
- Installing or vendoring the full [nousresearch/hermes-agent](https://github.com/nousresearch/hermes-agent) runtime
- Persistent skill libraries across users/sessions beyond local demo state
- Multi-user auth, training / fine-tuning, or real long-horizon agent fleets
- Creating a new GitHub repo (build only under this monorepo path)
- Creating the Vercel project or editing root README Live demos in this build PR (parent / human ships after merge)
- Baking any API keys or `.env` into the tree or build artifacts

## Outcome-oriented tasks
1. Scaffold **Next.js (App Router)** with Bun; initialize shadcn/ui (minimalist); write `bunfig.toml` with `minimumReleaseAge = 259200` **before** any install
2. Add `data/` seeded task pairs + scripted run fixtures (step events, extracted skill schema, reuse-run that cites the skill)
3. Studio UI: task picker → Run → **timeline** + **skill extraction** card → related-task Run with skill reuse highlighted; degraded banner when live keys absent
4. Wire scripted/local skill-loop harness end-to-end (no API key); optional live `/api` step only when `ANTHROPIC_API_KEY` present
5. README: how to run, env vars, attribution to Hermes Agent + the bookmark, note scripted vs optional live Anthropic path
6. Validation: at least one screenshot and one short video of the running app (hosted off-repo); link both in the PR; commit no media
7. Move this pick from `proposed` → `built` in `tracking/seen-bookmarks.json` (keep slug `hermes-skill-loop`, id `2100262432413528336`)
8. After merge: Vercel project (root dir `apps/hermes-skill-loop/`) + README Live demos table row (`App | App directory | Public URL | Notes`) — not part of this build PR; finish line = production URL in that table

## Stack
- Bun — runtime / package manager / scripts (monorepo default per AGENTS.md)
- Next.js (App Router) — sticky demo + easy serverless `/api` for optional live Anthropic
- shadcn/ui + Tailwind — minimal UI primitives (match sibling demos)
- Simulated/local Hermes-shaped skill-loop harness — run → extract skill → reuse (scripted first)
- Anthropic API — optional live act/extract steps when `ANTHROPIC_API_KEY` present
- Vercel — shareable host (`vercel.json`; serverless `/api` for live path; scripted path for zero-secret demos)

## Env (document in `.env.example` + README)
- `ANTHROPIC_API_KEY` — optional; enables live run/extract steps via `/api` (server-side only). Without it, scripted fixtures power the demo.
- Do **not** require secrets for the default Vercel production demo path.

## Reference
- Hermes Agent: https://github.com/nousresearch/hermes-agent
- Bookmark: https://x.com/JacquelineSYC19/status/2100262432413528336
- Monorepo build contract: root `AGENTS.md`

## Deferred
- Real Hermes Agent runtime / skill store integration
- Cross-session persistent skill library UI
- Multi-agent skill sharing
- Cloudflare deploy path
- Custom user-authored tasks beyond the seeded pairs

---

## Build instruction (Claude Code routine)

Build this demo end-to-end under `apps/hermes-skill-loop/` in the existing GitHub repo **chizhangucb/demo-apps** (do NOT create a new repo). Follow root `AGENTS.md` and this PLAN.md verbatim.

**Angle (must ship):** Single-user Next/Bun Vercel studio for the Hermes learning loop. User runs a canned multi-step task, watches a skill get extracted, then reuses that skill on a related task. Seed 2–3 task pairs under `data/`. Simulated/local Hermes-shaped harness only — no full Hermes runtime install. Scripted/no-key path first so Vercel demo works without secrets; optional live Anthropic behind env via serverless `/api` if easy (same env pattern as sibling demos). Finish line after merge = live Vercel production URL in root README Live demos table (do **not** invent URLs or edit that table in this build PR).

Required outcomes:
1. Implement the MVP in `apps/hermes-skill-loop/` only (Bun + Next.js App Router + shadcn; `bunfig.toml` with `minimumReleaseAge = 259200` before install; `bun install && bun run dev`).
2. Scripted/no-key demo path first: task run → skill extraction card → related-task reuse with skill highlighted. Optional live Anthropic behind env via serverless `/api`; clear degraded banner without keys. No full Hermes Agent runtime.
3. Open one PR to `main` on branch `demo-hermes-skill-loop` with a one-paragraph summary plus links to at least one screenshot and one short video (hosted off-repo; commit no media).
4. Update `tracking/seen-bookmarks.json`: move pick id `2100262432413528336` (slug `hermes-skill-loop`) from `proposed` to `built`.
5. Vercel-ready (`.env.example`, `vercel.json`). Attribute Hermes Agent (https://github.com/nousresearch/hermes-agent) and the bookmark https://x.com/JacquelineSYC19/status/2100262432413528336. Do **not** create the Vercel project or edit root README Live demos in this PR (post-merge ship: Root Directory `apps/hermes-skill-loop/`; finish line = production URL in Live demos).
6. Do **not** create a new GitHub repository. Stay inside `apps/hermes-skill-loop/` (plus the bookmark tracking update). Never touch sibling apps.
