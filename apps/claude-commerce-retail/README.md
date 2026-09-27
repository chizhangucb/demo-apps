# claude-commerce-retail

A thin, single-user storefront chat for a fictional shop ("Northwind Goods"). You ask for things in plain language. A Claude shopping agent searches a mock catalog, checks stock and store policy, and suggests items for your cart. Nothing gets added until you click, and there is no real checkout.

It thin-slices the retail storefront pattern from Anthropic's open-source [commerce-agents](https://github.com/anthropics/commerce-agents) blueprint (Apache-2.0). No code is vendored from it. Source bookmark: https://x.com/ClaudeDevs/status/2095233745167282602

## Run

```bash
cd apps/claude-commerce-retail
bun install && bun run dev
```

Open the URL Vite prints (default http://localhost:5173).

### Environment

| Var | Required | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | For the live agent | Read server-side only. Copy `.env.example` to `.env`, or export it in your shell. Prefer a **workspace-scoped** key so no workspace header is needed. |
| `ANTHROPIC_WORKSPACE_ID` | If the key is not workspace-scoped | Sent as `anthropic-workspace-id` on every Messages call. Find it in Claude Console → Settings → Workspaces (`wrkspc_…`). |
| `ANTHROPIC_MODEL` | No | Defaults to `claude-sonnet-5`. |
| `ANTHROPIC_EFFORT` | No | Defaults to `medium` (`low` / `medium` / `high`). |

With no key, the header shows **Mock mode**. Replies then come from a keyword-routed canned flow that calls the same four tool handlers, so the UI, tool chips, product cards and cart all still work.

## How it works

- `data/catalog.json` has 12 SKUs with per-size stock. `data/policies.json` has the returns, exchanges, shipping, warranty, gift and price-match text.
- `server/tools.ts` holds the tools as pure local functions, plus their JSON-schema definitions:
  - **browse**: search or filter by query, category, max price, size and in-stock, or fetch a single SKU
  - **policy**: look up policy text by topic
  - **inventory**: check stock for a SKU, or for one size of it
  - **cart_suggest**: check proposed adds against the catalog and stock. The UI turns accepted ones into "Add" buttons.
- `server/agent.ts` runs a manual tool-use loop on the Messages API (`@anthropic-ai/sdk`, adaptive thinking, medium effort (env-overridable), cached system prompt, server-side refusal fallback). It caps the loop at 6 tool rounds. The client's cart is sent with the latest user turn.
- The agent is served at `/api/chat` and `/api/status`. In dev, Vite middleware (`vite.config.ts`) serves them; on Vercel, serverless functions (`api/*.ts`) do. Both use the same server code, and the key never reaches the browser.
- `src/App.tsx` is the storefront: the chat transcript with tool-call chips, product cards with size pickers, suggested-cart rows, starter prompt chips, and a cart sidebar showing the subtotal and progress toward free shipping.

## Deploy (Vercel)

Create a Vercel project with **Root Directory** set to `apps/claude-commerce-retail`, then set `ANTHROPIC_API_KEY` in the project env (and `ANTHROPIC_WORKSPACE_ID` if the key is not workspace-scoped). `vercel.json` builds with Bun and serves the SPA plus `/api/*`.

## Out of scope

Merchant back-office, real payments/checkout/tax/fulfillment, accounts and persisted carts, and other verticals from the reference repo.

## License / attribution

The retail agent patterns (browse, policy, inventory and cart-suggest tools; a customer-facing shopping agent) are inspired by [anthropics/commerce-agents](https://github.com/anthropics/commerce-agents), licensed Apache-2.0. The catalog and policies are made-up demo data.
