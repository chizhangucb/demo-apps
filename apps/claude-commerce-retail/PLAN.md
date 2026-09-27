# claude-commerce-retail

## Goal
Thin single-user retail storefront chat demo inspired by Anthropic's open-source [commerce-agents](https://github.com/anthropics/commerce-agents) (Apache-2.0) retail blueprint: shoppers ask in natural language; a Claude-backed shopping agent browses a mock catalog, checks policy/inventory, and suggests cart adds — without building a full commerce stack.

Source bookmark: https://x.com/ClaudeDevs/status/2095233745167282602

## Single-user MVP
- One-page storefront chat (customer-facing shopping agent only; no merchant back-office UI)
- Mock product catalog (JSON): ~8–15 SKUs with name, price, category, stock, short description, image URL or placeholder
- Agent tool patterns (mock backends, not live Shopify/etc.):
  - **browse** — search / filter / get product detail from the mock catalog
  - **policy** — answer return/shipping/warranty style questions from a small policies.json
  - **inventory** — check stock / availability for a SKU or size
  - **cart-suggest** — propose add-to-cart / bundle suggestions; show a local cart panel (no real checkout)
- Chat UI with streaming or turn-based replies; show tool-call chips / cards when tools run
- Seeded starter prompts (e.g. "gift under $50", "in-stock sneakers size 10", "what's your return policy?")
- `bun install && bun run dev` from `apps/claude-commerce-retail/` only
- Root `bunfig.toml` with `[install] minimumReleaseAge = 259200` before any install
- Prefer **Vercel** shareable host when an API key is required (`ANTHROPIC_API_KEY` via env / Vercel project env); include `.env.example` and `vercel.json` mirroring sibling `jev-inbox-triage`
- Graceful degraded/mock mode if API key is missing so UI still demos with canned tool flows

## Explicitly out of scope
- Full merchant agent / back-office (inventory edits, campaigns, metrics)
- Real payment, checkout, tax, or order fulfillment
- Multi-user auth, accounts, or persisted carts beyond local session
- Cloning or vendoring the Python commerce-agents monorepo wholesale — **inspire and thin-slice** only; keep this app self-contained under Bun
- Telecom / entertainment / travel verticals from the reference repo
- Training or fine-tuning models

## Outcome-oriented tasks
1. Scaffold Vite + React with Bun; initialize shadcn/ui (minimalist); write `bunfig.toml` first
2. Add mock data: `data/catalog.json`, `data/policies.json` (and tiny inventory fields on catalog or separate file)
3. Implement tool handlers (browse / policy / inventory / cart-suggest) as pure local functions the agent can call
4. Wire Claude Messages API (or Anthropic SDK) with tool-use loop; server route under `api/` or Vite middleware — keep keys server-side; match sibling Vercel `/api` pattern when needed
5. Storefront UI: chat transcript + product/result cards + cart sidebar; starter prompt chips
6. README: how to run, required env (`ANTHROPIC_API_KEY`), Apache-2.0 attribution to https://github.com/anthropics/commerce-agents, link to bookmark
7. Validation: at least one screenshot and one short video of the running app (hosted off-repo); link both in the PR; commit no media
8. Move this pick from `proposed` → `built` in `tracking/seen-bookmarks.json` (keep slug `claude-commerce-retail`)

## Stack
- Bun — runtime / package manager / scripts (monorepo default per AGENTS.md)
- Vite + React — light SPA, matches `apps/jev-inbox-triage`
- shadcn/ui + Tailwind — minimal UI primitives
- Anthropic API (tool use) — shopping-agent brain; mock JSON backends for tools
- Vercel — preferred shareable host when API keys are needed (`vercel.json` + serverless `/api`)

## Reference
- Blueprint: https://github.com/anthropics/commerce-agents (Apache-2.0) — especially `examples/retail` storefront patterns
- Bookmark: https://x.com/ClaudeDevs/status/2095233745167282602
- Monorepo build contract: root `AGENTS.md`

## Deferred
- Merchant-agent twin app
- Real MCP / commerce-common Python runtime
- Persistent orders history
- Multi-retailer comparison
- Cloudflare deploy path
