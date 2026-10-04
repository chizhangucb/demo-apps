# Pi + Jev Harness

A single-user playground for a **Pi SDK-shaped agent harness loop** that uses Jev for three cheap control-plane decisions:

1. **Model pick** (`before_agent_start`) — Jev Choice *fast vs powerful* plus a complexity Score. High complexity or low confidence routes to the powerful model; otherwise Jev's pick wins.
2. **Tool gate** (`tool_call`) — Jev Noul *"is this call unsafe?"*. At or above the deny cutoff (default 0.65) the call is **denied**; below it, **allowed**.
3. **Done check** (`agent_end`) — Jev Score *"is this answer done and grounded?"*. Below the cutoff the harness says **keep going**; at or above it hands back.

This is the harness loop itself — not [`jev-inbox-triage`](../jev-inbox-triage) (which classifies support messages) and not [`agentrun-support-triage`](../agentrun-support-triage) (ticket workflow graph).

## Run

```bash
bun install
bun run dev     # http://localhost:3000
bun test        # scripted runner verdicts
```

## Modes

- **Scripted (default, no keys).** Three seeded tasks in `data/tasks.json` carry canned Jev probabilities, tool calls and draft answers. Together they cover a fast model and a powerful one, allowed and denied tool calls, and an answer that is done and one that is not. Pasted tasks fall back to small keyword heuristics plus a canned agent plan. No network, no secrets.
- **Live (optional).** With a key on the server, the same three questions go to real Jev through `POST /api/gate` (`@typesafe-ai/sdk` → `systemOne`), and the same policy decides. The agent's tool plan and draft answer stay simulated. Without a key the UI shows a degraded banner and stays scripted.

The **Policy** panel exposes all four thresholds (model confidence floor, complexity cutoff, tool deny cutoff, done cutoff). Nudge one and re-run to see verdicts flip.

## Env

See `.env.example`. Every key is optional and read only server-side.

| Var | Purpose |
| --- | --- |
| `OPENROUTER_API_KEY` | Live Jev via OpenRouter. Preferred when both are set. |
| `TYPESAFE_API_KEY` | Direct TypeSafe key. Used only if OpenRouter is unset. |

No chat-model keys: the control plane is Jev only.

## Pi SDK note

This ships a **thin Pi-shaped runner** (`src/lib/harness.ts`), not the official Pi agent SDK. It fires the same three extension hooks (`before_agent_start`, `tool_call`, `agent_end`) around a canned agent, so it runs with zero credentials, no Pi CLI and no real tool side effects. Nothing is ever executed. Allowed calls return canned results.

## Layout

- `data/tasks.json`: seeded tasks with scripted Jev answers
- `src/lib/harness.ts`: the loop, the three hooks and the policy logic
- `src/lib/scripted.ts` / `src/lib/live.ts`: scripted and live deciders (same interface)
- `src/server/jev.ts`, `src/app/api/{gate,status}`: serverless Jev calls (key precedence above)
- `src/components/harness/studio.tsx`: the studio UI

## Deploy (Vercel)

Create a Vercel project with **Root Directory** `apps/pi-jev-harness/`. `vercel.json` uses `bun install` / `bun run build`. The scripted path needs no env vars. Add a key to enable Live mode.

## Attribution

- Tutorial: Elvis Saravia, [Building a Custom Harness with Pi and Jev](https://academy.dair.ai/resources/jev-decisions-in-a-pi-sdk-harness) (DAIR.AI Academy)
- Bookmark: https://x.com/omarsar0/status/2102762406204076532
