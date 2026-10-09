# claude-dynamic-workflows

## Goal
Single-user **Claude Code dynamic workflows playground**: pick a preset task, see the small JavaScript workflow script Claude "wrote" for it, then watch that script run as parallel subagent lanes (each with its own model, context, and optional worktree) plus a separate judge step. Next to it, the same task runs in a single context, so early stopping, self-grading, and drift after compaction become visible side by side. Inspired by Thariq and Sid's post "A harness for every task: dynamic workflows in Claude Code".

Source bookmark: https://x.com/trq212/status/2061907337154367865 (Thariq)
Post: https://claude.dev/blog/a-harness-for-every-task-dynamic-workflows-in-claude-code/
Docs: https://code.claude.com/docs/en/workflows

## Background (embedded so the build does not depend on external links)

If any link in this PLAN fails to load, use this section as the source of truth. Do not search elsewhere.

### The post in short (Thariq Shihipar and Sid Bidasaria, Anthropic, Jun 2026)
- **What it is:** Claude Code can write its own harness on the fly, custom-built for the task. A dynamic workflow is a JavaScript file that Claude writes and a background runtime executes. It spawns and coordinates subagents. The script can choose **which model each agent uses** and **whether a subagent runs in its own worktree** (intelligence level and isolation per agent). Interrupted workflows resume where they left off. Trigger by asking for a workflow or with the keyword `ultracode`.
- **Why (three failure modes of one long context):**
  - **Agentic laziness:** stopping before a complex multi-part task is finished and declaring it done after partial progress (example: addressing 35 of 50 items in a security review).
  - **Self-preferential bias:** preferring its own results, especially when asked to verify or judge them against a rubric.
  - **Goal drift:** gradual loss of fidelity to the original objective across many turns, especially after compaction. Each summary is lossy; edge-case requirements and "don't do X" constraints get lost.
  - Workflows counter these with separate subagents, each with its own context window and a focused, isolated goal.
- **Dynamic vs static:** a static harness (Agent SDK, `claude -p`) runs the same steps for every task and must be generic. A dynamic workflow is shaped to the one task in front of it.
- **Six patterns Claude composes:** classify-and-act (a classifier routes work, or classifies output at the end); fan-out-and-synthesize (many agents in clean contexts, then a barrier that merges structured outputs); adversarial verification (a separate agent checks each output against a rubric); generate-and-filter (generate many ideas, filter by rubric or verification, dedupe); tournament (N agents attempt the same task with different approaches, a judging agent compares results pairwise until a winner; comparative judgment beats absolute scoring); loop until done (keep spawning until a stop condition such as no new findings).
- **Example prompts from the post:** "Take my business plan and run a workflow where different agents tear it apart from an investor's, a customer's, and a competitor's perspective." "I need a name for this CLI tool. Use a workflow to brainstorm a bunch of options and run a tournament to pick the top 3." "Go through my blog post draft and verify every technical claim against the codebase using a workflow." "Here's a folder of 80 resumes, rank them for the backend role and double-check the top ten."
- **More patterns:** deep verification (one checker agent per factual claim, optional source auditor behind each); rule-by-rule review (one verifier per rule, then a skeptic filters false positives); root-cause investigation (hypotheses from disjoint evidence, each facing verifiers and refuters); model routing (a classifier picks Sonnet vs Opus per subtask); quarantine (agents that read untrusted content have no privileges; the acting agent only sees their summaries).
- **When not to use:** workflows cost more tokens; most routine coding tasks do not need a panel of five reviewers. Token budgets can be set in the prompt ("use 10k tokens").

### The docs in short (code.claude.com/docs/en/workflows)
- **Script shape:** plain JavaScript with top-level `await`, optionally starting with `export const meta = { name, description, phases? }`. Example from the docs:
```javascript
export const meta = { name: 'audit-routes', description: 'Audit every route handler for missing auth checks' }

const found = await agent('List every .ts file under src/routes/.', {
  schema: { type: 'object', required: ['files'], properties: { files: { type: 'array', items: { type: 'string' } } } },
})
const audits = await pipeline(found.files, file =>
  agent(`Audit ${file} for missing authentication checks.`, { label: file }),
)
return audits.filter(Boolean)
```
- **Primitives:** `agent(prompt, opts)` spawns one subagent (opts include `schema` for JSON output validated with up to 5 retries, `label`, `model`, `stallMs`; isolation in a worktree is also chosen per agent, exact option name not in this summary, so use `{ isolation: 'worktree' }` and label it illustrative). `parallel([() => agent(...), ...])` runs a set at once and waits for all (a barrier). `pipeline(items, stage...)` runs one per item. `phase(title)` groups following agents under a title in the progress view. `log(msg)` shows a message. `args` is a global input. An `agent()` resolves to `null` if stopped or after an unrecoverable error, hence `.filter(Boolean)`.
- **Where results live:** in script variables, not in Claude's context. The script decides what runs next; Claude's context holds only the final answer. Compare: subagents/skills keep results in Claude's context and Claude decides turn by turn.
- **Runtime rules:** no mid-run user input; no direct filesystem or shell from the script (agents do that); no `import()`; `Date.now()`, `Math.random()` and `new Date()` throw so a relaunch repeats the same agent calls; up to 16 concurrent agents by default; max 4,096 items per `parallel`/`pipeline`; max 1,000 agents per run. Agents whose output stalls restart (up to 5 restarts, shown as `(retry 1)`).
- **Models:** each agent's model follows subagent rules; a model the script names wins; otherwise the session model. If a model is blocked by an allowlist, the agent runs on a substitute and the progress view names both.
- **Progress view (`/workflows`):** phases with agent counts, drill into an agent to see its prompt, recent tool calls, result, and token usage. Keys: `p` pause, `x` stop, `r` restart, `s` save as a command (`.claude/workflows/` or `~/.claude/workflows/`).
- **Approval:** before a run Claude Code shows the planned phases with "Yes, run it", "View raw script", "No".
- **Cost:** a "Large workflow" warning appears past 25 agents or 1.5M projected tokens. Size guideline: small (<5 agents), medium (<10, default), large (<50).

## Single-user MVP
- One sticky App Router page, three regions (stack on narrow screens):
  1. **Task picker + script**: preset tasks (below) with their prompt and inputs. A **Generated workflow** panel shows the JavaScript workflow script for the task (syntax highlighted, `meta` block, `phase()`, `agent()` with `model`, `label`, `schema`, worktree isolation where relevant, `parallel()` / `pipeline()`). A small approval card mirrors Claude Code's ("Yes, run it" / "View raw script" / "No") with the planned phases and agent count.
  2. **Workflow run (lanes)**: one lane per subagent, running in parallel. Each lane header shows label, **model** (for example Haiku for brainstorming, Sonnet for workers, Opus for the judge), **context** (fresh window, tokens used, what it was given), and a worktree badge when isolated. Lanes stream their output. Phases group lanes. A visible **Judge** lane runs after the barrier in its own context, never the author of what it judges, and shows its rubric, pairwise comparisons or per-item verdicts, and the final pick. A run summary shows agents spawned, tokens per lane and total, wall time, and the final answer.
  3. **Single-context run (baseline)**: the same task done by one agent in one context window, streamed beside the workflow. Annotated callouts make the failure modes visible: **early stop** (declares done after partial coverage, with a coverage meter such as "6 of 12 claims checked"), **self-grading** (scores its own output with an inflated score, labelled "graded by its own author"), and **drift after compaction** (a "compaction" marker after which a constraint from the prompt is dropped, highlighted in the output). A comparison strip scores both runs on the same rubric: coverage, constraint kept, independent judge yes/no, tokens.
- **Preset tasks (ship at least these three, as data under `data/tasks/`):**
  1. **Name this CLI (tournament)**: brainstorm agents on different models generate names, a pipeline of pairwise judge agents runs a bracket, the top 3 come out. Baseline: one context lists names and picks its own favourites, praising them.
  2. **Tear apart this business plan (fan-out + synthesize)**: investor, customer, and competitor agents each critique a short sample plan in a clean context; an adversarial verifier checks each critique against the plan; a synthesizer merges. Baseline: one context role-plays all three, critiques blur together and get softer, a constraint ("do not suggest raising prices") is lost after compaction.
  3. **Verify every claim in a blog draft (deep verification)**: one agent extracts claims, one checker per claim (some in a worktree against a sample repo snapshot), a skeptic filters false positives. Baseline: stops early after checking a few claims and declares the draft verified.
  Each task is data: the script text, the phases, the lanes (label, model, context summary, isolation, scripted output chunks, tokens), the judge (rubric, comparisons, verdict), the baseline transcript with annotated failure moments, and the rubric scores. Adding a task is a file edit.
- **The script is real code, executed by a small simulated runtime.** Implement `agent`, `parallel`, `pipeline`, `phase`, `log` in a sandboxed in-app runtime that executes the shown script. In scripted mode `agent()` resolves from the task data (matched by `label`) with paced streaming; the orchestration (fan-out, barrier, bracket loop, filter) is genuinely run by the script. Mirror the runtime rules: no `import()`, `Date.now()` / `Math.random()` throw, concurrency cap of 16, `null` results filtered. Run the script on the server (route handler) or a Web Worker, never with unrestricted `eval` on the main thread.
- **Streaming:** lanes stream over SSE from a route handler (`POST /api/run`) with typed events (`phase`, `agent_start`, `agent_delta`, `agent_done`, `judge`, `baseline_delta`, `baseline_marker`, `run_done`). Paced so parallelism is visible.
- **Scripted / no-key path first.** The default demo uses zero API keys and zero external network calls and works on Vercel with zero secrets. Clear "Scripted mode" badge.
- **Optional live mode (only if easy):** if `ANTHROPIC_API_KEY` is set (same env names and pattern as sibling `apps/claude-agent-loops`: `ANTHROPIC_API_KEY`, `ANTHROPIC_WORKSPACE_ID`, `ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT`, server-side only), `agent()` calls in the script go to the Messages API with the lane's model, each in its own fresh context, and the baseline runs as one long conversation. Keep strict caps (max agents per run, max tokens per agent, a per-run token budget shown in the UI) and fall back to scripted on any error. On Vercel the parent will reuse the existing key from the claude-agent-loops project, so add no new secret names.
- `bun install && bun run dev` from `apps/claude-dynamic-workflows/` only
- `bunfig.toml` with `[install] minimumReleaseAge = 259200` before any install
- **Vercel-ready**: `.env.example` (all optional), `vercel.json` mirroring sibling apps; SSE route uses the Node runtime, `dynamic = "force-dynamic"`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`, and a `maxDuration` that covers the longest run
- **Finish line (post-merge ship, not this build PR):** live Vercel production URL plus a root README **Live demos** table row (`App | App directory | Public URL | Notes`)

## Explicitly out of scope
- Running real Claude Code, the real Workflow tool, real git worktrees, a real shell, or real files beyond small sample inputs in `data/`
- Saving workflows as commands, `/workflows` keybindings, resume after interruption (mention in README only)
- Multi-user auth, persistence beyond localStorage
- Duplicating siblings: `claude-agent-loops` (one agent's loop patterns: turn, goal, time, proactive), `claude-code-mods` (hooks), `harness-router` (one protocol across harnesses), `opendots-coworkers` (two coworkers with permissions). This app is about a script that orchestrates many isolated subagents plus an independent judge, versus one context
- Creating a new GitHub repo, creating the Vercel project, or editing root README Live demos in this build PR
- Baking any API keys or `.env` into the tree or build artifacts

## Outcome-oriented tasks
1. Scaffold **Next.js (App Router)** with Bun. Initialize shadcn/ui (minimalist). Write `bunfig.toml` with `minimumReleaseAge = 259200` **before** any install
2. `data/tasks/*.json` (three presets) plus each task's workflow script as a `.js` text file
3. `src/lib/workflow/runtime.ts`: sandboxed runtime exposing `agent`, `parallel`, `pipeline`, `phase`, `log`, `args`, enforcing the runtime rules above, emitting typed events
4. `src/lib/workflow/scripted.ts`: resolves `agent()` calls from task data with paced streaming; `src/lib/workflow/live.ts` (optional) calls the Messages API per lane
5. `POST /api/run` SSE route that runs the workflow and the single-context baseline concurrently and streams both
6. UI: task picker, script panel with approval card, lanes grouped by phase with model, context, worktree badge and tokens, judge lane, baseline column with annotated early stop, self-grading and drift markers, comparison strip
7. README: how to run; how the script maps to lanes; the three failure modes and where each shows up; note that runs are simulated in scripted mode. Attribute the post (Thariq Shihipar and Sid Bidasaria, Anthropic), the Claude Code docs, and the bookmark
8. A few unit tests (bun test): the runtime runs a script, `parallel` is a barrier, `pipeline` keeps `null` slots, banned globals throw, the tournament bracket yields a winner
9. Validation: at least one screenshot and one short video of the running app (hosted off-repo) showing the generated script, parallel lanes with models, the judge step, and the single-context baseline with its failure markers. Link both in the PR. Commit no media
10. Move this pick from `proposed` to `built` in `tracking/seen-bookmarks.json` (keep slug `claude-dynamic-workflows`, id `2061907337154367865`)
11. After merge: Vercel project (root dir `apps/claude-dynamic-workflows/`) plus README Live demos table row. Not part of this build PR

## Stack
- Bun: runtime, package manager, scripts (monorepo default per AGENTS.md)
- Next.js (App Router): one page plus a streaming route handler on Vercel
- shadcn/ui + Tailwind: minimal UI primitives, matches sibling demos
- Local runtime for workflow primitives: real orchestration code without Claude Code itself
- Vercel: shareable host (`vercel.json`; zero-secret production path)

## Env (document in `.env.example` + README)
- No required secrets
- Optional: `ANTHROPIC_API_KEY`, `ANTHROPIC_WORKSPACE_ID`, `ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT`, server-side only, same pattern as `apps/claude-agent-loops/.env.example`
- Never add new secret names

## Reference
- Bookmark: https://x.com/trq212/status/2061907337154367865
- Post: https://claude.dev/blog/a-harness-for-every-task-dynamic-workflows-in-claude-code/ (see Background if unreachable)
- Docs: https://code.claude.com/docs/en/workflows (see Background if unreachable)
- Siblings (do not duplicate): `apps/claude-agent-loops`, `apps/claude-code-mods`, `apps/harness-router`, `apps/opendots-coworkers`
- Monorepo build contract: root `AGENTS.md`

## Deferred
- Running real Claude Code workflows through the Agent SDK
- Real worktrees and real repo edits
- Save, resume, pause, and restart controls
- Loop-until-done and classify-and-act presets
- User-authored scripts

---

## Build instruction (Claude Code routine)

Build this demo end-to-end under `apps/claude-dynamic-workflows/` in the existing GitHub repo **chizhangucb/demo-apps** (do NOT create a new repo). Follow root `AGENTS.md` and this PLAN.md verbatim.

**Angle (must ship):** Single-user Next/Bun Vercel playground for Claude Code dynamic workflows. Pick a preset task, see the JavaScript workflow script, then watch it run as parallel subagent lanes (each showing its model and context, worktree badge where isolated) with a visible, independent judge step. Beside it, a single-context run of the same task makes early stopping, self-grading, and drift after compaction visible. Scripted/no-key path first. Optional live mode via `ANTHROPIC_API_KEY` only.

Required outcomes:
1. Implement the MVP in `apps/claude-dynamic-workflows/` only (Bun + Next.js App Router + shadcn; `bunfig.toml` with `minimumReleaseAge = 259200` before install; `bun install && bun run dev`).
2. Scripted/no-key path with the three presets, the script panel, a sandboxed runtime that actually executes the shown script, parallel lanes over SSE, the judge lane, the single-context baseline with failure markers, and the comparison strip.
3. Open one PR to `main` on branch `demo-claude-dynamic-workflows` with a one-paragraph summary plus links to at least one screenshot and one short video (hosted off-repo; commit no media).
4. Update `tracking/seen-bookmarks.json`: move pick id `2061907337154367865` (slug `claude-dynamic-workflows`) from `proposed` to `built`.
5. Vercel-ready (`.env.example`, `vercel.json`). Attribute the post, the docs, and the bookmark. Do **not** create the Vercel project or edit root README Live demos in this PR.
6. Do **not** create a new GitHub repository. Stay inside `apps/claude-dynamic-workflows/` (plus the tracking update). Never touch sibling apps.
7. If any link in this PLAN fails, use the Background section above and do not search elsewhere.
