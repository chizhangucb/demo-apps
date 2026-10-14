# Magpie Routing Groups

A single-user playground for [magpie](https://github.com/yetone/magpie) by [@yetone](https://x.com/yetone) ([usemagpie.ai](https://usemagpie.ai)), the local app and gateway that puts any model behind any coding agent. Give Claude Code, Codex and Gemini CLI each a model from one shared `provider/model` list, build a routing group from a few subscriptions and keys, and replay a scripted coding day with a live routing view of which account answers each turn and why. Compare the five routing modes as quota windows run dry, read the cost and leftover quota ledger, and toggle intent routing.

Inspired by [this bookmark](https://x.com/yetone/status/2105194385868718426). Not affiliated with magpie.

**Simulated gateway.** No real agents, accounts, keys or providers are involved. The gateway at `127.0.0.1:3425`, the agent configs, the subscriptions and their quota windows are simulated. The routing engine is real TypeScript running in your browser, and it follows magpie's README and `docs/reference.md`. Runs in **Scripted mode** with zero secrets.

## Run

```bash
bun install
bun run dev      # http://localhost:3000
bun test         # routing engine tests, one block per mode
bun run lint && bun run typecheck
```

## What it shows

1. **Agents.** Each agent has a model picker over one list (`group/daily-coding`, `claude/claude-opus-5-5`, `codex/gpt-5.5-codex`, ...). Changing a pick shows the `magpie claude|codex|gemini <model>` command and a diff of the one config key that changes (file shapes are illustrative).
2. **Group builder.** `group/daily-coding` holds two Claude Max accounts, ChatGPT Plus (Codex), Copilot Pro+, a Kimi coding plan and a DeepSeek API key (marked as a fallback model). Each plan has 5-hour and weekly windows with a used share and a reset time; the key has none. Reorder members, pause, include, mark fallback, and pick `routing=`, `stays=`, Sink and intent routing. The matching `magpie group add` command updates live.
3. **Scripted day.** 57 deterministic turns from 08:00 to 17:32 over eleven conversations (refactors, test runs, long sessions, quick questions). Play, step, 1x to 8x, reset.
4. **Live routing view.** Agent lanes color each turn by the account that answered. Every turn shows the candidate order after each of the six pick steps, every attempt (429, 503, exhausted), the account that answered and why, in the docs' words. Failovers show on the gateway row only; the agent lane never sees an error (except with `stays=strict`, which passes it through, as documented). Quota bars show the 90% and 98% bands and a reminder when a week renews soon with much unused.
5. **Mode comparison.** The same day under smart, order, rotate, usage and pace as small multiples: week quota lost at resets, failovers, prompt cache misses, cost at list price and turns per account.
6. **Ledger.** Per account and key: turns, tokens, cache reads and writes, cost at list price, quota left per window, quota lost at reset. Totals per mode.
7. **Intent routing.** A small classifier model tags each new turn; tests, refactors and long sessions go to the strong tier first and quick questions to the cheap tier, with the other tier kept as a fallback. Per-turn tags and the cost delta against intent off.

## Routing rules modelled (from the magpie docs)

- `smart` (default): of the accounts under 90% used, the one whose allowance renews soonest goes first. The week decides; the 5-hour window decides only when weeks renew in the same hour. Resets are compared to the hour.
- `order`: the first member takes every request until it is used up (100%) or fails.
- `rotate` (In turn): each turn of a conversation goes to the next member; a new conversation goes to the account with the fewest other conversations in the last 30 minutes.
- `usage` (Least used first): lowest share used first, ties by fewest tokens sent lately.
- `pace` (Weekly pace): highest `share of week left / hours until renewal (at least 1)` first. 60% left with 20 hours to go is 3 per hour.
- Smart and pace bands: at 90% or more of a window an account goes behind the others, at 98% behind those.
- Pick steps: (1) skip paused accounts and accounts at their cap, (2) order by mode, (3) with Sink on, accounts rate limited while they still had quota go last, (4) fallback models after, (5) resting accounts last but never dropped, (6) the conversation's account first per `stays` (`auto`, `session`, `turn`, `off`, `strict`). Stickiness never brings back a resting account or one at 98% (100% for order); `strict` keeps it anyway and passes errors to the agent.
- A failover happens on 429, 5xx or an exhausted key; the failed account rests and the next is asked.

**Illustrative, not from the docs:** quota caps, start shares, reset times and list prices; the rest time (15 min) and Sink memory (60 min); the prompt cache model (hit when the same account answered the conversation within 5 minutes; cache reads count 10% toward quota); keys without windows going after plan accounts in smart, usage and pace; rotate ignoring stickiness other than `strict`; `weight` routing is not included. These are labelled in the UI.

## Code map

- `src/lib/routing/engine.ts`: pure routing engine (`pickOrder` with the six steps, `orderByMode`, bands, `pace`, `simulate` with resets, failover, resting, Sink, stays, cache and cost).
- `src/lib/routing/types.ts`: types and mode labels.
- `data/scenario.ts`: the fictional accounts, the shared model list, the scripted conversations and the scripted outages.
- `src/components/magpie/`: agents panel, group builder, routing view, comparison, ledger and intent panels.
- `tests/routing.test.ts`: unit tests per mode (including the pace example and order holding the first member until 100%), pick steps, stays, and day-level checks.

## Optional live reply

If `ANTHROPIC_API_KEY` is set (same env names as `apps/claude-agent-loops`, server-side only, see `.env.example`), the selected turn gets a **Live reply** button that asks Claude for a two sentence reply as the routed model: at most 3 calls per run, 600 max tokens, scripted reply on any error. Routing stays scripted.

## How this differs from harness-router

[`apps/harness-router`](../harness-router) puts one protocol over many agent harnesses: you run Codex, Claude Code and others behind one Responses-style API and compare their sessions. magpie goes the other way: it keeps each agent's own harness and puts many models and accounts behind it, routing every request across subscriptions and keys by their quota windows, failing over without the agent noticing.

## Not included

A real gateway, real agent configs, OAuth or subscription sign-in, plugins and middleware, `weight` routing, nested groups, sharing, sync, Docker.

## Deploy

Vercel, Root Directory `apps/magpie-routing-groups/`, no environment variables needed. `vercel.json` uses Bun for install and build.
