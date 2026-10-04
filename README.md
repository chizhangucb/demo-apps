# demo-apps

Sticky monorepo for weekday X-bookmark tech demos.

Each approved pick lands under `apps/<slug>/` as a self-contained Bun app.

## Live demos

Each demo is deployed as its own Vercel project with **Root Directory** set to `apps/<slug>/`. When a demo gets a public URL, add a row to this table.

| App | App directory | Public URL | Notes |
| --- | --- | --- | --- |
| Jev Inbox Triage | `apps/jev-inbox-triage` | https://jev-inbox-triage.vercel.app | Vercel; live Jev via server-side `OPENROUTER_API_KEY` |
| Claude Commerce Retail | `apps/claude-commerce-retail` | https://claude-commerce-retail.vercel.app | Vercel; live Claude (Sonnet 5, medium effort) via server-side `ANTHROPIC_API_KEY` + `ANTHROPIC_WORKSPACE_ID` — not mock |
| Archify System Map | `apps/archify-system-map` | https://archify-system-map.vercel.app | Vercel; sample IR + offline sketch work without a key; Generate/Refine live via server-side `ANTHROPIC_API_KEY` + `ANTHROPIC_WORKSPACE_ID` |
| AgentRun Support Triage | `apps/agentrun-support-triage` | https://agentrun-support-triage.vercel.app | Vercel; scripted mode without keys; optional live Jev via `OPENROUTER_API_KEY`/`TYPESAFE_API_KEY`; optional live Claude via `ANTHROPIC_API_KEY` |
| Codex Security Scan | `apps/codex-security-scan` | https://codex-security-scan.vercel.app | Vercel; scripted dual-target (canned sample + chronicle) without keys; optional Live via server-side `OPENAI_API_KEY` (SDK modes need Python+git, off on Vercel) |
| Claude Agent Loops | `apps/claude-agent-loops` | https://claude-agent-loops.vercel.app | Vercel; scripted loops without keys; optional Live via server-side `ANTHROPIC_API_KEY` + `ANTHROPIC_WORKSPACE_ID` |
| Hermes Skill Loop | `apps/hermes-skill-loop` | https://hermes-skill-loop.vercel.app | Vercel; scripted run/extract/reuse without keys; optional Live via server-side `ANTHROPIC_API_KEY` + `ANTHROPIC_WORKSPACE_ID` |
| Claude Code Mods | `apps/claude-code-mods` | https://claude-mods-playground.vercel.app | Vercel; scripted mod playground (deny/rewrite/pass-through) without keys; optional Suggest via server-side `ANTHROPIC_API_KEY` + `ANTHROPIC_WORKSPACE_ID` |
| Pi + Jev Harness | `apps/pi-jev-harness` | https://pi-jev-harness.vercel.app | Vercel; scripted three-gate harness (model pick, tool allow/deny, done score) without keys; live Jev via server-side `OPENROUTER_API_KEY` or `TYPESAFE_API_KEY` |
