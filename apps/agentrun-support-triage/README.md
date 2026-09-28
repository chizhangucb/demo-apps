# AgentRun Support-Triage Studio

A single-user studio for an [AgentRun](https://github.com/Parcha-ai/agentrun)-style support-triage workflow:
**tool search → Jev judge → optional agent investigate → resolve / escalate**. Pick a seeded ticket (or paste
your own), press **Run workflow**, and watch the step graph light up while the run trace fills in with tool
hits, the Jev branch distribution + confidence, the agent's findings, and the final disposition.

Inspired by [this bookmark](https://x.com/MiguelriosEN/status/2101029313906987422) about
[AgentRun](https://agentrun.ai/) — Parcha's workflow DSL/harness for repetitive agent work, powered by Jev.

## Run

```sh
bun install
bun run dev   # http://localhost:3000
```

No keys needed. `bunfig.toml` pins `minimumReleaseAge = 259200` (3 days) for installs.

## How it works

- **Real interpreter.** The workflow in `src/lib/workflow.ts` is an AgentRun v2 document and is executed by
  [`@parcha/agentrun-dsl`](https://www.npmjs.com/package/@parcha/agentrun-dsl) `runWorkflow` on the server
  (`/api/run`). The studio's graph and trace come from the interpreter's `onEvent` stream plus the host adapters.
  The package is used (not a hand-rolled fallback); `0.1.0-beta.4` is pinned because newer betas are inside the
  3-day release-age window.
- **Workflow shape:** `call kb.search` → `route` (Jev chooses `resolve` / `investigate` / `escalate`, with
  `unsure: {branch: escalate, gte: 0.6}`) → `resolve`: code reply · `investigate`: `agent` → `escalate` when
  `investigation.needs_human` → code reply · `escalate`: `escalate human_review`.
- **Host adapters** (`src/server/runner.ts`):
  - `runEffect` — the `kb.search` tool, over `data/kb.json` (local only; no web search).
  - `runJudge` — scripted fixtures for seeded tickets / keyword heuristic for pasted ones, or **live Jev** via
    [`@parcha/agentrun-jev`](https://www.npmjs.com/package/@parcha/agentrun-jev) `createJevRunner`.
  - `runNode` — scripted investigation, or a **live Claude agent** that submits the `Investigation` schema through
    a forced tool call. The agent's host tools (`account.lookup`, `billing.ledger`, `logs.search`,
    `status.incidents`) return canned demo data in both modes — there are no real CRM/log connectors.
- **Seeded tickets** (`data/tickets.json`) cover every path: auto-resolve (2FA), investigate → resolve (duplicate
  charge), investigate → escalate (export outage), direct escalate (GDPR + legal), and low-confidence → escalate.

## Live mode (optional)

Copy `.env.example` to `.env.local`. All keys stay server-side in the `/api` routes.

| Variable | Enables |
| --- | --- |
| `OPENROUTER_API_KEY` | Live Jev judge via OpenRouter (takes precedence) |
| `TYPESAFE_API_KEY` | Live Jev judge via TypeSafe directly |
| `ANTHROPIC_API_KEY` | Live investigate agent (Claude, default `claude-sonnet-5`) |
| `ANTHROPIC_WORKSPACE_ID` | Only for multi-workspace Anthropic keys |
| `ANTHROPIC_MODEL` | Optional agent model override |

Without keys the page shows a **Scripted mode** banner and the Live toggle is disabled; with only one provider it
shows **Partially live** and the other node stays scripted. Each trace step is badged with its source.

## Deploy

`vercel.json` is ready (Next.js, `bun install`, `bun run build`). Create a Vercel project with Root Directory
`apps/agentrun-support-triage/`; scripted mode works with no env vars. Node ≥ 22.19 is required by the AgentRun
packages.

## Relation to `jev-inbox-triage`

[`apps/jev-inbox-triage`](../jev-inbox-triage) is the Jev *decision* UI (typed questions over an inbox). This app is
the *harness* layer around a decision: a workflow graph where a Jev judgment is one node that routes between tools,
an agent, and a human escalation.

## Attribution

AgentRun DSL and Jev adapter © Parcha, Apache-2.0 — https://github.com/Parcha-ai/agentrun · https://agentrun.ai/.
Jev / System One by [TypeSafe](https://docs.typesafe.ai/).
