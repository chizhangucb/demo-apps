# Magpie Routing Groups: PLAN

## Goal

A single-user Next.js + Bun playground on Vercel that shows what magpie does for people who run several coding agents on several subscriptions and keys: give Claude Code, Codex and Gemini CLI each a model from one list, build a routing group from a few accounts, and replay a scripted coding day with a live routing view of which account answers each turn. Compare the five routing modes (smart, order, rotate, usage, pace) as quota windows run dry, with a cost and leftover-quota ledger and an intent routing toggle. The gateway, agents and providers are simulated and labelled as such.

Source: bookmark https://x.com/yetone/status/2105194385868718426 (@yetone), repo https://github.com/yetone/magpie (README.md, docs/reference.md "Routing groups" and "How magpie picks an account"), site https://usemagpie.ai.

If any link above fails to load, use the Background summary below and do not search elsewhere.

## Background (embedded summary of the magpie README and docs/reference.md)

What it is: a local app plus gateway (`127.0.0.1:3425`) that puts any model behind any coding agent. It speaks OpenAI Chat, OpenAI Responses, Anthropic Messages and Gemini and translates between them (streaming, tool calls, reasoning). Examples: Claude Code on Kimi, Codex on DeepSeek, Gemini CLI on GLM. Models are named `provider/model`. magpie rewrites the one key that matters in each agent's own config. Subscriptions you are signed in to (Claude, ChatGPT/Codex, Copilot, Gemini Code Assist, Grok and more) become providers for every other agent, and a subscription can hold several accounts that fail over.

CLI shapes (use these verbatim in the UI's command pane):
```sh
magpie provider add deepseek sk-...
magpie claude deepseek/deepseek-v4-pro          # Claude Code on DeepSeek
magpie codex moonshot/kimi-k2.5                 # Codex on Kimi
magpie group add "Opus anywhere" models=claude/claude-opus-5-5,copilot/claude-opus-5.5 routing=smart
magpie group set opus-anywhere routing=usage
magpie claude group/opus-anywhere               # fails over between subscriptions
magpie quota                                    # what's left on every plan
```

Routing group: several models an agent picks as one, `group/<id>`. The gateway routes each request over every member's keys and accounts. Groups can contain groups. When a quota runs out, the group moves to the next account or model and the agent never sees the error.

Routing modes (`routing=`), real names and behavior:
- `smart` (default): of the accounts under 90% used, the one whose allowance renews soonest goes first, because what it has left is lost at the reset. The biggest window decides (the week; the 5-hour window only when weeks renew in the same hour). Reset times are compared to the hour.
- `order`: the first member takes every request until it is used up (100%) or fails, then the next.
- `rotate` (shown as "In turn"): each turn of a conversation goes to the next member. A new conversation goes to the account with the fewest other conversations in the last 30 minutes.
- `usage` (Least used first): the lowest share used first; ties by fewest tokens sent lately.
- `pace` (Weekly pace): highest pace first, where pace = share of the week left / hours until the week renews (at least 1). Example: 60% left with 20 hours to go is 3 per hour.
- (`weight` also exists: each member takes a share by its weight. Optional in the demo.)
- Smart and pace bands: an account at 90% or more of a window goes behind the others, and at 98% or more behind those.

How an account is picked per request, in order: (1) who can answer: skip paused accounts and accounts at their usage cap; (2) order by the routing mode; (3) with Sink on, accounts rate limited (429) while they still had quota go last; (4) the provider's fallback models after its own accounts; (5) accounts resting after a failure go last but are never dropped; (6) the conversation's account first: once an account has answered a conversation it stays at the front per `stays=` (`auto` default: while the vendor prompt cache is worth keeping, roughly while the last request read and wrote at least 1,024 cached tokens and answered within 5 minutes; also `session`, `turn`, `off`, `strict`). Stickiness never brings back a resting account or one at 98% of a window (100% for order); `strict` keeps it anyway and passes errors to the agent. A failover happens on a 429, a 5xx, an unreachable host or an exhausted key; the failed one rests and the next is asked.

Intent routing: a small model of your choice reads each new turn, so tests go to the strong model and quick questions to the cheap one. The Routing view shows every decision live, with an explanation per turn.

Usage and cost: tokens, cache reads and writes, cost at list price, quota windows per key, plan and account (5-hour and weekly), a reminder before a window renews with much unused, per-account and per-key bills.

## Single-user MVP

1. Agents panel: Claude Code, Codex and Gemini CLI, each with a model picker over one shared `provider/model` list (including `group/<id>` entries). Changing a pick shows the matching `magpie claude|codex|gemini ...` command and a diff of the one config key that changes (illustrative file shapes).
2. Group builder: build `group/daily-coding` from a few fictional accounts and keys, for example two Claude Max accounts, one ChatGPT Plus (Codex) account, a Copilot account, a DeepSeek API key and a Kimi coding plan. Each has 5-hour and weekly windows with used share and reset times (keys without windows behave as the docs say). Pick the mode (smart, order, rotate, usage, pace, optional weight) and `stays`.
3. Scripted coding day: a deterministic timeline of about 40 to 60 turns across the three agents and several conversations (quick questions, refactors, test runs, long sessions), driven by a sim clock. Play, step, speed, reset.
4. Live routing view: for each turn, the agent, the conversation, the candidate order after each pick step (1 to 6), the account that answered, why (in the docs' words), and any failover (429 or exhausted, the failed account resting). The agent lane never shows an error during a failover.
5. Mode comparison: run the same day under all five modes side by side (small multiples) and show how each spends quota: wasted quota at resets for smart vs order, even spread for usage, weekly smoothing for pace, cache misses for rotate. Anything not directly stated in the docs (exact numbers, cache cost effects) is labelled "illustrative".
6. Ledger: per account and per key, tokens, cache reads, cost at list price, quota left per window, and quota lost at reset. Totals per mode.
7. Intent routing toggle: a small classifier model tags each new turn (test, refactor, quick question...) and sends tests to the strong model and quick questions to the cheap one; show the per-turn classification and the cost delta vs off.
8. Badges: "Simulated gateway: no real agents, accounts or providers" and "Scripted mode". Optional live mode: if `ANTHROPIC_API_KEY` is set (same env names as `apps/claude-agent-loops`, server-side only), one capped live reply for the selected turn (strict per-run cap, small max tokens, fallback to scripted). No new secret names. Zero secrets on Vercel.

## Out of scope

Real gateway, real agent configs, OAuth or subscription sign-in, plugins and middleware, sharing, sync, Docker.

## Tasks

1. Scaffold `apps/magpie-routing-groups/` with Bun, Next.js App Router, TypeScript, Tailwind, shadcn. `bunfig.toml` with `minimumReleaseAge = 259200` before install.
2. Pure TypeScript routing engine in `src/lib/routing/` implementing the six pick steps, the five modes (plus optional weight), the 90/98 bands, stays, resting and failover. Unit tests per mode with the docs' examples (pace 60% left over 20 hours = 3/h; order holds the first until 100%).
3. Scripted day in `data/`, deterministic.
4. UI per the MVP, with mode comparison and ledger.
5. README: what is simulated, attribution, and a short "How this differs from harness-router" section: harness-router (apps/harness-router) puts one protocol over many agent harnesses (run Codex, Claude Code and others behind one Responses-style API); magpie keeps each agent's own harness and puts many models and accounts behind it, routing per request across quotas.
6. Commit `.env.example` with a `!.env.example` line in the app `.gitignore`. `vercel.json` if needed.

## Stack and env

Bun, Next.js App Router, TypeScript, Tailwind, shadcn/ui. `bun install && bun run dev`. Vercel Root Directory `apps/magpie-routing-groups`. Optional env: `ANTHROPIC_API_KEY`, `ANTHROPIC_WORKSPACE_ID`, `ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT` (same names as claude-agent-loops).

## Build instructions for the Claude Code routine

Build only in `apps/magpie-routing-groups/` plus moving tracking id `2105194385868718426` (slug `magpie-routing-groups`) from `proposed` to `built` in `tracking/seen-bookmarks.json`. Branch `demo-magpie-routing-groups`, one PR to `main`. Scripted no-key path first. Use the real mode names and behavior above; label unverified details as illustrative. Attribute magpie (@yetone, github.com/yetone/magpie, usemagpie.ai) and the bookmark. Do not create the Vercel project, do not edit the root README Live demos table, do not create a repo, do not touch sibling apps. Screenshots and a short video off-repo as a Claude artifact linked in the PR; commit no media. No em dashes or en dashes anywhere you write, including a generated `AGENTS.md`. If a link fails, use the Background summary above.
