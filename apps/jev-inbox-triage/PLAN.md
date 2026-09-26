# jev-inbox-triage

## Goal
Single-user demo: paste support-style messages and get Jev (TypeSafe System One) decisions — department route (Choice), human-review flag (Noul), urgency (Score) — with confidence bars and an act-only-if-confident gate.

## Single-user MVP
- One page: textarea for 1–N messages (or a few sample stubs)
- Call Jev via `@typesafe-ai/sdk` / public API for Choice, Score, and Noul on each message
- Show typed answers + calibrated confidence; highlight when confidence is below a simple threshold
- `bun install && bun run dev` from `apps/jev-inbox-triage/`
- Root `bunfig.toml` with `[install] minimumReleaseAge = 259200` before any install

## Explicitly out of scope
- Real inbox / email / Slack connectors
- Multi-user auth or persistence beyond local session
- Chatbot UI or free-form conversation
- Training / fine-tuning Jev
- Cloudflare deploy for this PR

## Outcome-oriented tasks
1. Scaffold Vite + React with Bun; shadcn/ui minimalist
2. Wire Jev client (env `TYPESAFE_API_KEY` or documented key); graceful error if missing
3. Triage UI: paste messages → run → cards with Choice / Score / Noul + confidence bars + gate
4. Seed 3–5 sample support messages for one-click demo
5. README: how to run, required env, what Jev is doing
6. Validation: screenshot + short video of running app; attach both to the PR

## Stack
- Bun — runtime / package manager / scripts (monorepo default)
- Vite + React — light single-page demo without framework overhead
- shadcn/ui — minimal UI primitives
- `@typesafe-ai/sdk` — official JS client for Jev / System One
- Tailwind — pairs with shadcn

## Deferred
- Streaming / batch jobs
- Saving triage history
- Cloudflare Pages path preview
- Multi-channel inbox adapters
