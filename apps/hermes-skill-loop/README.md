# Hermes Skill Loop

A single-page Bun + Next.js studio for the **Hermes Agent learning loop**
([Nous Research Hermes Agent](https://github.com/nousresearch/hermes-agent), via
[@JacquelineSYC19](https://x.com/JacquelineSYC19/status/2100262432413528336)): the agent solves a multi-step task,
**distils a skill** from what worked, then **reuses that skill** on a related task.

1. **Run the task** — pick a seeded task pair and hit **Run task** (or **Run full loop**). The timeline shows each
   think → tool → observe → answer event, including the dead ends the agent backs out of.
2. **Extract a skill** — once the run finishes, the harness reviews it and writes a skill card shaped like Hermes'
   `~/.hermes/skills/<name>/SKILL.md`: when to use it, a procedure distilled from the successful path, pitfalls learned
   from the dead ends, and the tools it needs. It lands in the session **Skill library**.
3. **Reuse on a related task** — **Run with skill** loads the skill first; every event that follows a procedure step is
   tagged *skill step N* and the matching step lights up in the skill card. **Run cold** replays the same task with no
   skill so the scoreboard compares events, tool calls, dead ends and tokens side by side.

This is a simulated, Hermes-*shaped* harness — not the Hermes Agent runtime. Nothing is installed from or vendored
out of the Nous repo, and tool calls are never executed.

## Run

```bash
bun install
bun run dev   # http://localhost:3000
```

## Seeded task pairs (`data/tasks.ts`)

| Learn on | Skill | Reuse on |
| --- | --- | --- |
| Clean Q3 sales CSV → revenue by region | `tidy-csv-report` | Clean Q4 support tickets CSV → volume by category |
| Draft v2.3 release notes from merged PRs | `release-notes-from-prs` | Draft v2.4 release notes |
| Find why `test_checkout_total` is flaky | `triage-flaky-test` | Triage flaky `test_login_redirect` |

Each pair carries the learn run, the extracted skill, and the related task as both a warm (skill loaded) and a cold run.

## Modes

| Mode | Needs | Run | Extract |
| --- | --- | --- | --- |
| **Scripted** (default) | nothing | Replays fixture events | Replays the fixture skill with a trace computed from the real run stats |
| **Live** | `ANTHROPIC_API_KEY` | Claude plans the run in a simulated sandbox via `POST /api/loop` (`phase: "run"`), with the skill injected for warm runs | Claude distils the skill from the live transcript (`phase: "extract"`) |

Without a key the page shows a degraded-mode banner and the Live toggle is disabled. In Live mode the cold column of
the scoreboard fills only once you **Run cold**.

## Env (`.env.example`)

All optional, read server-side only:

- `ANTHROPIC_API_KEY` — enables Live mode.
- `ANTHROPIC_WORKSPACE_ID` — only for keys not scoped to a single workspace.
- `ANTHROPIC_MODEL` — default `claude-opus-5-5`.
- `ANTHROPIC_EFFORT` — default `low`.

## Deploy (Vercel)

Create a Vercel project with **Root Directory** `apps/hermes-skill-loop/`. `vercel.json` sets Bun install/build.
The scripted path needs no env vars; add `ANTHROPIC_API_KEY` to enable Live.

## Layout

- `data/tasks.ts` — seeded task pairs (learn run, skill, warm + cold reuse runs)
- `src/lib/harness.ts` — run stats, extraction trace, SKILL.md rendering
- `src/server/claude.ts` + `src/app/api/loop/route.ts` — optional live run/extract
- `src/components/studio/studio.tsx` — the studio UI

## Credits

- [Hermes Agent](https://github.com/nousresearch/hermes-agent) by Nous Research — the self-improving agent whose
  skills + memory loop this demo imitates.
- Bookmark: https://x.com/JacquelineSYC19/status/2100262432413528336
