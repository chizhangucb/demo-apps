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

| Variable           | Required | Notes                                                          |
| ------------------ | -------- | -------------------------------------------------------------- |
| `TYPESAFE_API_KEY` | for live | TypeSafe AI API key read by `@typesafe-ai/sdk` on the server.  |

Without the key the app stays usable: a banner explains the key is missing and
results come from clearly-labeled local sample heuristics instead of Jev. Set
the key and restart `bun run dev` for live answers. The key never reaches the
browser — the SDK runs inside a Vite dev-server middleware (`server/triage.ts`
wired in `vite.config.ts`) behind `POST /api/triage`.

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
