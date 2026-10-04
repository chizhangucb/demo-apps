# pi-jev-harness

## Goal
Single-user **Pi + Jev harness playground**: a sticky Bun/Next.js demo of a Pi SDK-shaped agent loop that uses Jev for three cheap control-plane calls (pick a model, allow or deny a tool, score whether the answer is done). Inspired by Elvis Saravia's [Building a Custom Harness with Pi and Jev](https://academy.dair.ai/resources/jev-decisions-in-a-pi-sdk-harness). This is the harness loop itself, not another inbox classifier.

Source bookmark: https://x.com/omarsar0/status/2102762406204076532

## Single-user MVP
- One sticky App Router page: pick a seeded task (or paste a short task), then **Run harness**
- Seed **3 tasks** under `data/` so each run hits all three gates with different outcomes (example shapes: safe read + fast model + done, risky delete blocked, unfinished answer that fails the done check)
- Visible **loop timeline** with exactly three Jev gates, each showing the question, canned or live probability, threshold, and verdict:
  1. **Model pick** (before the request): Choice of fast vs powerful plus a complexity Score. High complexity or low confidence routes to the powerful model. Otherwise use Jev's pick.
  2. **Tool gate** (before each tool call): Noul-style yes/no ("is this call unsafe?"). At or above a threshold (default 0.65) the call is **denied**. Below it, **allow**. Show at least one allowed call and one denied call across the seeds.
  3. **Done check** (after the draft answer): Score whether the answer is done and grounded. Below threshold means not done (show a short "keep going" note). At or above means hand back.
- **Scripted / no-key path first**: canned probabilities and verdicts drive the whole loop with zero network and no API keys, so the Vercel demo works with zero secrets
- Thresholds live in one visible policy (model confidence floor, tool-deny cutoff, done-score cutoff) so a user can nudge a number and re-run scripted mode
- Optional **Live** mode behind env via serverless `/api` only: the same three questions go to real Jev. Keys server-side only. Precedence `OPENROUTER_API_KEY` then `TYPESAFE_API_KEY` (same pattern as `apps/jev-inbox-triage` and `apps/agentrun-support-triage`). If keys are missing, stay on scripted mode and show a clear degraded banner
- Pi-shaped hooks only (`before_agent_start` / `tool_call` / answer check). Do **not** require the Pi CLI, a real coding-agent session, or filesystem side effects. Prefer the official Pi agent SDK if it installs cleanly under Bun and can run a scripted loop without credentials. Otherwise ship a thin Pi-shaped runner and say so in the README
- `bun install && bun run dev` from `apps/pi-jev-harness/` only
- Root `bunfig.toml` with `[install] minimumReleaseAge = 259200` before any install
- **Vercel-ready**: `.env.example`, `vercel.json` mirroring sibling apps. Scripted mode works without keys
- **Finish line (post-merge ship, not this build PR):** live Vercel production URL plus a root README **Live demos** table row (`App | App directory | Public URL | Notes`)

## Explicitly out of scope
- Duplicating `jev-inbox-triage` (that app classifies support messages). This app is the three-gate harness loop
- Duplicating `agentrun-support-triage` (workflow graph for tickets). Do not rebuild that studio
- Installing or requiring the Pi CLI, a real repo checkout, or executing real shell / file tools
- Multi-user auth, persistence beyond the local session, or a full agent authoring IDE
- Training or fine-tuning Jev, or calling a chat model for the three control-plane decisions
- Creating a new GitHub repo (build only under this monorepo path)
- Creating the Vercel project or editing root README Live demos in this build PR (parent ships after merge)
- Baking any API keys or `.env` into the tree or build artifacts

## Outcome-oriented tasks
1. Scaffold **Next.js (App Router)** with Bun. Initialize shadcn/ui (minimalist). Write `bunfig.toml` with `minimumReleaseAge = 259200` **before** any install
2. Add `data/` seeded tasks plus scripted fixtures: for each task, model-pick probabilities, per-tool gate probabilities, and a done-check score, with expected verdicts
3. Studio UI: task chips plus paste box, policy thresholds, Run. Timeline of the three gates with probability bars and allow / deny / route / done verdicts. Degraded banner when live keys are absent
4. Wire the scripted runner end-to-end (no API key). Optional live `/api` only when `OPENROUTER_API_KEY` or `TYPESAFE_API_KEY` is present. Live mode must ask the same three questions (model Choice + complexity Score, tool-unsafe Noul, done Score) and apply the same policy
5. README: how to run, env vars, attribution to the DAIR.AI Pi + Jev tutorial and the bookmark, and a note that this is the harness loop (not `jev-inbox-triage`)
6. Validation: at least one screenshot and one short video of the running app (hosted off-repo). Link both in the PR. Commit no media
7. Move this pick from `proposed` to `built` in `tracking/seen-bookmarks.json` (keep slug `pi-jev-harness`, id `2102762406204076532`)
8. After merge: Vercel project (root dir `apps/pi-jev-harness/`) plus README Live demos table row. Not part of this build PR. Finish line is the production URL in that table

## Stack
- Bun: runtime, package manager, and scripts (monorepo default per AGENTS.md)
- Next.js (App Router): sticky demo plus serverless `/api` for optional live Jev
- shadcn/ui + Tailwind: minimal UI primitives (match sibling demos)
- Pi SDK (TypeScript coding-agent toolkit): use the official agent loop if it installs cleanly. Otherwise a thin Pi-shaped harness with the three hooks. Document which path shipped
- Jev / TypeSafe via OpenRouter or `TYPESAFE_API_KEY`: live Choice, Noul, and Score for the three gates only
- Vercel: shareable host (`vercel.json`; serverless `/api` for live path; scripted path for zero-secret demos)

## Env (document in `.env.example` + README)
- `OPENROUTER_API_KEY`: optional. Enables live Jev through OpenRouter (server-side only). Preferred when both keys exist
- `TYPESAFE_API_KEY`: optional. Direct TypeSafe key. Used only if OpenRouter is unset
- Do **not** require secrets for the default Vercel production demo path
- Do **not** add Anthropic or other chat-model keys. The control plane is Jev only

## Reference
- Tutorial: https://academy.dair.ai/resources/jev-decisions-in-a-pi-sdk-harness
- Bookmark: https://x.com/omarsar0/status/2102762406204076532
- Sibling (do not duplicate): `apps/jev-inbox-triage` (inbox classify), `apps/agentrun-support-triage` (ticket workflow)
- Jev key pattern: sibling `.env.example` files (`OPENROUTER_API_KEY` then `TYPESAFE_API_KEY`)
- Monorepo build contract: root `AGENTS.md`

## Deferred
- Real Pi CLI session or coding against a user repo
- Executing real tools (shell, file delete, web)
- Failure-recovery hooks beyond the three gates
- Saving run history across sessions
- Cloudflare deploy path

---

## Build instruction (Claude Code routine)

Build this demo end-to-end under `apps/pi-jev-harness/` in the existing GitHub repo **chizhangucb/demo-apps** (do NOT create a new repo). Follow root `AGENTS.md` and this PLAN.md verbatim.

**Angle (must ship):** Single-user Next/Bun Vercel playground for a Pi SDK-shaped harness loop. Scripted Run shows three Jev gates with canned probabilities: pick a model (fast vs powerful), allow or deny a tool, score whether the answer is done. Live mode hits real Jev through serverless `/api` using `OPENROUTER_API_KEY` or `TYPESAFE_API_KEY` (same precedence as sibling demos). No Pi CLI and no real tool side effects. This is the harness loop, not `jev-inbox-triage`. Finish line after merge is a live Vercel production URL in the root README Live demos table (do **not** invent URLs or edit that table in this build PR).

Required outcomes:
1. Implement the MVP in `apps/pi-jev-harness/` only (Bun + Next.js App Router + shadcn; `bunfig.toml` with `minimumReleaseAge = 259200` before install; `bun install && bun run dev`).
2. Scripted/no-key demo path first: seeded tasks, visible thresholds, timeline of the three gates with probabilities and verdicts. Optional live Jev behind env via serverless `/api`. Clear degraded banner without keys. No Pi CLI.
3. Open one PR to `main` on branch `demo-pi-jev-harness` with a one-paragraph summary plus links to at least one screenshot and one short video (hosted off-repo; commit no media).
4. Update `tracking/seen-bookmarks.json`: move pick id `2102762406204076532` (slug `pi-jev-harness`) from `proposed` to `built`.
5. Vercel-ready (`.env.example`, `vercel.json`). Attribute the DAIR.AI tutorial (https://academy.dair.ai/resources/jev-decisions-in-a-pi-sdk-harness) and the bookmark https://x.com/omarsar0/status/2102762406204076532. Do **not** create the Vercel project or edit root README Live demos in this PR (post-merge ship: Root Directory `apps/pi-jev-harness/`; finish line is the production URL in Live demos).
6. Do **not** create a new GitHub repository. Stay inside `apps/pi-jev-harness/` (plus the bookmark tracking update). Never touch sibling apps.
