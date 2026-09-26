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

Copy `.env.example` to `.env` (Bun loads it automatically for `bun run dev`)
or export the variables in your shell. You need at most one key:

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
