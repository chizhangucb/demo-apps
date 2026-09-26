# Jev Inbox Triage

Single-user demo: paste support-style messages and let Jev (TypeSafe System
One) triage them — department route (**Choice**), urgency (**Score**), and a
human-review flag (**Noul**) — each with calibrated confidence and an
act-only-if-confident gate.

## Run

```sh
cd apps/jev-inbox-triage
bun install
bun run dev
```

Open http://localhost:5173, click **Load samples**, then **Triage 5 messages**.

## Environment

Copy `.env.example` to `.env` — the dev server loads it automatically on
startup (via Vite's `loadEnv` in `vite.config.ts`; no `VITE_` prefix, so keys
stay server-only). Alternatively export the variables in your shell, which
takes precedence over `.env`. You need at most one key:

| Variable             | Notes                                                                 |
| -------------------- | --------------------------------------------------------------------- |
| `OPENROUTER_API_KEY` | Live Jev via OpenRouter — no TypeSafe waitlist needed. Preferred.     |
| `TYPESAFE_API_KEY`   | Live Jev via the TypeSafe API directly (key is currently waitlisted). |

Precedence: `OPENROUTER_API_KEY` → `TYPESAFE_API_KEY` → sample heuristics.

- **OpenRouter (recommended):** grab a key at
  [openrouter.ai/keys](https://openrouter.ai/keys). OpenRouter proxies
  TypeSafe System One at the same API shape, so the app keeps using the
  official `@typesafe-ai/sdk` and just points it at
  `https://openrouter.ai/api` with your OpenRouter key. Bare model ids like
  `jev-latest` are mapped by OpenRouter. See the
  [OpenRouter TypeSafe SDK guide](https://openrouter.ai/docs/guides/community/typesafe-sdk).
- **Neither key:** the app stays usable — a banner explains no key is set and
  results come from clearly-labeled local sample heuristics instead of Jev.

The header badge shows which mode is active: `live · OpenRouter`,
`live · TypeSafe`, or `sample mode`. Keys never reach the browser — the SDK
runs inside a Vite dev-server middleware (`server/triage.ts` wired in
`vite.config.ts`) behind `POST /api/triage`.

## Deploy to Vercel

The Vite dev middleware only exists locally, so production uses **Vercel
serverless functions** in `api/` that import the exact same `server/triage.ts`
logic:

| Route              | File            | Handler                                        |
| ------------------ | --------------- | ---------------------------------------------- |
| `GET /api/status`  | `api/status.ts` | web-standard `GET(): Response`                 |
| `POST /api/triage` | `api/triage.ts` | web-standard `POST(request: Request)`          |

They use Vercel's Node runtime with [web-standard method handlers](https://vercel.com/docs/functions/functions-api-reference)
(exporting `GET`/`POST` gives automatic 405s for other methods), so there are
no extra dependencies and no `@vercel/node` types. The frontend already calls
relative `/api/*` URLs, so everything stays same-origin — no CORS setup.

`vercel.json` (in this app directory) pins the rest:

- `installCommand: bun install` / `buildCommand: bun run build` — Vercel
  supports Bun natively and also auto-detects it from `bun.lock`.
- `framework: vite`, `outputDirectory: dist`.
- SPA fallback rewrite `/((?!api/).*) → /index.html` that leaves `/api/*`
  to the serverless functions.

### One-time setup

1. In [Vercel](https://vercel.com/new), import the `demo-apps` GitHub repo.
2. Set **Root Directory** to `apps/jev-inbox-triage` (Project → Settings →
   Build & Development if you missed it during import). This is a monorepo:
   one Vercel project per demo app is fine for now.
3. In **Project → Settings → Environment Variables**, add
   `OPENROUTER_API_KEY` (preferred) and/or `TYPESAFE_API_KEY` for both
   **Production** and **Preview**. Key precedence is the same as local:
   `OPENROUTER_API_KEY` → `TYPESAFE_API_KEY` → sample heuristics.
4. Deploy (or redeploy after adding/changing env vars — env changes only
   apply to new deployments).

Without any key the deployed app still works in clearly-labeled sample mode;
with a key the header badge flips to `live · OpenRouter` / `live · TypeSafe`.
Keys stay server-side in the functions and never reach the browser. Any
client-side route falls back to `index.html`, while `/api/*` keeps hitting
the functions.

Local `bun run dev` is unchanged — the Vite middleware still serves `/api/*`
in dev, and `api/*.ts` is only used by Vercel.

## What Jev is doing

One `systemOne` call per message with three questions:

- `choice` — which support department should handle this (billing, technical,
  account, orders, other), returning a label plus per-label probabilities.
- `score` — urgency on a 0–3 rubric (can wait → critical), returning an
  expected score and confidence.
- `noul` — should a human review this before any automated action, returning
  P(yes).

The UI renders confidence bars for each answer and applies a gate: a message
is auto-routed only when the department confidence beats the slider threshold
(default 75%) and the human-review probability stays under 50%. Otherwise it
is held for a human.

## Stack

Bun · Vite · React · Tailwind · shadcn/ui · `@typesafe-ai/sdk`
