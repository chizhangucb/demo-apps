# Claude dynamic workflows playground

A single-user playground for Claude Code dynamic workflows. Pick a preset task, read the JavaScript workflow script Claude wrote for it, approve it, and watch a sandboxed runtime execute that script as parallel subagent lanes, each with its own model and clean context (worktree badge where isolated), plus a visible independent judge. Beside it, one agent in one context does the same task, so early stopping, self-grading and drift after compaction show up side by side. A comparison strip scores both runs on the same rubric.

Runs in **scripted mode**: no API key, no network, no real Claude Code, worktrees or shell.

## Run

```bash
bun install
bun run dev      # http://localhost:3000
bun test         # runtime + preset tests
bun run lint && bun run typecheck
```

## Presets (`data/tasks/`)

| Task | Pattern | Script |
| --- | --- | --- |
| Name this CLI | Tournament: 3 brainstormers (Haiku, Haiku, Sonnet), a bracket of fresh Opus judges, an independent final ranking | `cli-name-tournament.workflow.js` |
| Tear apart this business plan | Fan-out (investor, customer, competitor on Sonnet), adversarial verification (one Opus verifier per critique), synthesize | `business-plan-teardown.workflow.js` |
| Verify every claim in a blog draft | Deep verification: extractor, one checker per claim (code claims in a worktree), Opus skeptic filters false positives | `blog-claim-check.workflow.js` |

Each task is a JSON file (prompt, inputs, planned phases, scripted lane outputs keyed by `label`, judge rubric and verdicts, the single-context transcript with its failure markers, and the comparison rows) plus a `.workflow.js` script. Adding a task is a file edit plus one import in `src/lib/tasks.ts`.

## How the script maps to lanes

- `src/lib/workflow/runtime.ts` runs the shown script in a `node:vm` context on the server (inside `POST /api/run`, never `eval` on the main thread). It exposes `agent`, `parallel`, `pipeline`, `phase`, `log` and `args`, and mirrors the docs' runtime rules: no `import()`, `Date.now()` / `new Date()` / `Math.random()` throw, string code generation is off, at most 16 agents run at once, at most 4,096 items per `parallel` / `pipeline`, at most 1,000 agents per run, and a failed agent resolves to `null` so `.filter(Boolean)` works. Values cross the sandbox boundary only as JSON. `node:vm` is not a hard security boundary, so the route only runs the fixed scripts in `data/tasks/`, never user input.
- `src/lib/workflow/scripted.ts` resolves each `agent()` call from task data by its `label` and streams it with pacing. Bracket bouts and the final ranking are computed from the task's ranking table, so the script's own loop decides who meets whom and when the bracket stops. The orchestration (fan-out, barrier, bracket loop, filters) is really run by the script.
- Each `agent()` call becomes one lane: label, model (the model the script names wins, else the session model), context summary, worktree badge for `{ isolation: 'worktree' }` (illustrative option name), streamed output, tokens, and `(retry 1)` when a stalled lane restarts. `phase()` groups lanes. Judge lanes are outlined in violet and show their rubric, verdicts and pick.
- `POST /api/run` streams typed SSE events: `run_start`, `phase`, `log`, `agent_start`, `agent_delta`, `agent_retry`, `agent_done`, `judge`, `baseline_delta`, `baseline_marker`, `baseline_done`, `run_done`, `error`.

## The three failure modes and where they show up

- **Agentic laziness (early stop):** the baseline's coverage meter stops short (4 of 12 names, 5 of 9 issues, 6 of 12 claims) and an orange "Declares done" marker appears.
- **Self-preferential bias (self-grading):** the baseline scores its own work (9.5/10, 9/10, 10/10), marked "Graded by its own author". The workflow's judges run in their own context and never judge their own output.
- **Goal drift after compaction:** a "Context compacted" marker drops the context meter, and a constraint from the prompt (8 character names, no price increases, cite file and line) is lost. Drifted text is underlined in red.

## Not included

Real Claude Code, the real Workflow tool, git worktrees, a shell, saving workflows as commands, `/workflows` keys, and resume after interruption (real workflows resume where they left off; this demo just reruns). Live mode via `ANTHROPIC_API_KEY` is not wired; see `.env.example`.

## Deploy

Vercel, Root Directory `apps/claude-dynamic-workflows/`, no environment variables needed. `vercel.json` uses Bun for install and build.

## Credits

- Post: [A harness for every task: dynamic workflows in Claude Code](https://claude.dev/blog/a-harness-for-every-task-dynamic-workflows-in-claude-code/) by Thariq Shihipar and Sid Bidasaria, Anthropic
- Docs: [Claude Code workflows](https://code.claude.com/docs/en/workflows)
- Bookmark: [x.com/trq212/status/2061907337154367865](https://x.com/trq212/status/2061907337154367865)
