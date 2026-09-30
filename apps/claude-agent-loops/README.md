# Claude Agent Loops

A single-page Bun + Next.js studio for the four agent-loop patterns from
[@ClaudeDevs](https://x.com/ClaudeDevs/status/2074208949205881033): **turn**, **goal**, **time** and
**proactive** loops. Pick a canned task and a loop type, edit the goal, the verification criteria and the
turn/token budget, then hit **Run**. The timeline shows every turn as **Act → Evaluate → Continue/Stop**,
with a live turns/budget/clock scoreboard and a **Done** badge that says *why* the loop stopped.

The harness is the same for every loop type; only the Continue/Stop rule changes
(`src/lib/harness.ts → decide()`):

| Loop | Stops when | Shows |
| --- | --- | --- |
| **Turn** | the agent says it is done | Trusting the model: on *Refine landing copy* it stops at turn 3 with a check still failing |
| **Goal** | every verification criterion passes | Verifier feedback drives each retry until all rules pass |
| **Time** | the check passes; otherwise sleeps `intervalSec` and re-checks | Polling a fake deploy every 30s until green |
| **Proactive** | the triggered work verifies, or the watch window closes | Idle watch ticks; acts only when an alert fires |

All loops also stop on the max-turn cap or when the token budget is spent.

## Run

```bash
bun install
bun run dev   # http://localhost:3000
```

## Canned tasks (`data/tasks.ts`)

1. **Refine landing copy** (goal) — five drafts of a hero; rules: headline ≤ 8 words, mentions "flaky tests", contains "free trial", no "revolutionary", no "!".
2. **Poll a deploy until green** (time) — a fake `/deploys/482` goes queued → building → green.
3. **Watch alerts, open an incident** (proactive) — an alert stream with idle ticks, a p95 breach, then an on-call handoff.

Every task replays under all four loop types, so you can compare how each loop decides to stop on the same work.

## Modes

| Mode | Needs | Act | Evaluate |
| --- | --- | --- | --- |
| **Scripted** (default) | nothing | Replays the task fixture | Local rule verifier (`src/lib/verify.ts`) checks the real output |
| **Live** | `ANTHROPIC_API_KEY` | Claude takes each turn via `POST /api/step` (`phase: "act"`), given goal, criteria, previous output and verifier feedback | Local rules first; criteria the rules can't parse go to Claude as a judge (`phase: "judge"`) |

The verifier understands `Contains "x"` / `Mentions "x"`, `No "x"` and `Headline at most N words`. Any other
line shows as *unchecked* in scripted mode and is judged by Claude in live mode. In live mode the
fixture still supplies observations and triggers (deploy status, alerts) so the world stays deterministic.

Without a key the page shows a degraded-mode banner and the Live toggle is disabled.

## Env (`.env.example`)

- `ANTHROPIC_API_KEY` — optional; enables Live mode (server-side only).
- `ANTHROPIC_WORKSPACE_ID` — only for keys not scoped to one workspace.
- `ANTHROPIC_MODEL` — default `claude-opus-5-5`. `ANTHROPIC_EFFORT` — default `low`.

Live requests enable server-side refusal fallbacks (`fallbacks: "default"`).

## Scope

This is a simulated local harness. It does not integrate with Claude Code's `/goal` or `/loop` commands.

## Deploy (Vercel)

Root Directory `apps/claude-agent-loops/`; `vercel.json` sets `bun install` / `bun run build`. No env vars are
required: scripted mode works as is. Add `ANTHROPIC_API_KEY` to enable Live.
