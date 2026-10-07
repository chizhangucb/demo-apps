# opendots-coworkers

## Goal
Single-user **OpenDots coworkers playground**: two always-on AI coworkers ("Dots"), a **Researcher** and a **Writer**, each with its own role, permissions, and simulated computer. The user hands them a task. Researcher findings stream into the UI as AG-UI events, the Writer turns them into an editable page, and any action a Dot is not allowed to take shows up as a visible permission denial. Inspired by CopilotKit's open source OpenDots template.

Source bookmark: https://x.com/ataiiam/status/2105710796198322659
Upstream: https://github.com/CopilotKit/OpenDots (MIT)

## Background (embedded so the build does not depend on external links)

If any link in this PLAN fails to load, use this section as the source of truth. Do not search elsewhere.

### OpenDots in short (from the upstream README and docs/COMPUTERS.md, Oct 2026)
- **What it is:** an open source, self-hostable template for persistent AI coworkers, "each with its own computer". A template, not a hosted product. Built with CopilotKit and AG-UI. Status: alpha, MIT.
- **Specialist Dots:** each Dot has a name, role, instructions, and permitted tools. Upstream's own example: "A researcher can investigate a topic; a writer can turn findings into a draft. Inspect their work and control what they can do." Dots have separate roles and separate conversations. Multi-Dot group chat and automatic delegation are listed upstream as further work, so in this demo the handoff from Researcher to Writer is an explicit, visible step.
- **Spaces and pages:** a Space is a home for working documents. Finished work lands as an editable page (visual editor, autosave, revision checks, Markdown source mode). Each Dot has a default destination Space for saved pages.
- **Dot computers:** each Dot can have its own container computer (via CopilotKit's OpenBot supervisor). The Computer panel shows **browser**, **files**, **terminal**, and **activity**. Browser, workspace-file, and shell permissions are saved **per Dot**, checked by the server, and **start disabled**. No action falls back to the host. The **Activity** log records action name, who requested it, and success or failure, and deliberately excludes typed values, file contents, and full commands. Revoking a capability cancels the active request and blocks later actions.
- **Review before saving:** a human-in-the-loop card pauses the conversation with **Approve & save** or **Decline**. Approval creates the page and returns a link. A changed draft needs a new review.
- **Connections:** per-Dot MCP tools. Read-only tools run on their own; any other tool pauses for an **Approve & run** card.
- **Architecture:** Web app (pages, Spaces, Dots, chat) talks **AG-UI** to the CopilotKit runtime, which drives specialist agents, which go through **tool permissions** to an isolated browser/workspace. Real computers need Docker, which Vercel cannot host. This demo simulates the computer.

### AG-UI in short (from docs.ag-ui.com introduction, architecture, events)
- **What it is:** an open, lightweight, event-based protocol that connects any agent backend to a user-facing app. Transport agnostic; the common path is HTTP POST of a `RunAgentInput` body that returns a stream of events over **SSE** (`text/event-stream`, one JSON event per `data:` line).
- **Core interface:** an agent implements `run(input: RunAgentInput) -> Observable<BaseEvent>`. `RunAgentInput` carries `threadId`, `runId`, `messages`, `tools`, `context`, `state`, `forwardedProps`.
- **BaseEvent:** `{ type, timestamp?, rawEvent?, metadata? }`. Most events also accept an optional `subagentRunId` to attribute output to a subagent.
- **Event types used in this demo (wire names are SCREAMING_SNAKE_CASE):**
  - Lifecycle: `RUN_STARTED {threadId, runId}`, `RUN_FINISHED {threadId, runId, result?, outcome?}`, `RUN_ERROR {message, code?}`, `STEP_STARTED {stepName}`, `STEP_FINISHED {stepName}`. Every run starts with RUN_STARTED and ends with RUN_FINISHED or RUN_ERROR.
  - Text: `TEXT_MESSAGE_START {messageId, role}`, `TEXT_MESSAGE_CONTENT {messageId, delta}` (non-empty chunk, concatenate in order), `TEXT_MESSAGE_END {messageId}`.
  - Tool calls: `TOOL_CALL_START {toolCallId, toolCallName, parentMessageId?}`, `TOOL_CALL_ARGS {toolCallId, delta}` (JSON fragments), `TOOL_CALL_END {toolCallId}`, `TOOL_CALL_RESULT {messageId, toolCallId, content, role?: "tool"}`.
  - State: `STATE_SNAPSHOT {snapshot}` (replace), `STATE_DELTA {delta}` (RFC 6902 JSON Patch array), `MESSAGES_SNAPSHOT {messages}`.
  - Activity: `ACTIVITY_SNAPSHOT {messageId, activityType, content}`, `ACTIVITY_DELTA {messageId, activityType, patch}`. Good fit for the simulated computer panel.
  - Subagents: `SUBAGENT_STARTED {subagentRunId, name, description?}`, `SUBAGENT_FINISHED {subagentRunId, result?}`, `SUBAGENT_ERROR {subagentRunId, message, code?}`. Use one subagent run per Dot so the UI can attribute each event to Researcher or Writer.
  - Interrupts (human in the loop): `RUN_FINISHED` with `outcome: {type: "interrupt", interrupts: [...]}` pauses the run; the client resumes with a new run whose input carries a `resume` array. Use this for "Approve & save".
  - Special: `CUSTOM {name, value}` for app-specific events. Use `CUSTOM name: "permission_denied"` for denials.
- **Client:** `HttpAgent` from `@ag-ui/client` POSTs `RunAgentInput` and parses the SSE stream. Optional; a small hand-written SSE reader is fine.

## Single-user MVP
- One sticky App Router page, three columns (stack on narrow screens):
  1. **Dots roster**: Researcher and Writer cards. Each shows role, instructions, and a permissions grid (browser, files, shell, web research, save page) with toggles. Defaults: Researcher = browser on, web research on, files on, shell off, save page off. Writer = browser **off**, files on, shell off, web research off, save page on.
  2. **Run timeline**: task input plus Run button, and a live AG-UI event stream grouped by Dot (subagent). Shows streamed text, tool calls with args, step markers, and a raw-event toggle that prints each event's `type` and JSON.
  3. **Computer + Page**: tabs for each Dot's simulated computer (browser URL bar plus fake page snapshot, files list, terminal output, activity log) and the **editable page** the Writer produces.
- **Flow (scripted default):**
  1. User picks a canned task (or types one). Run.
  2. Researcher: `browser.navigate`, `browser.snapshot`, `files.write notes.md`, streams 3 to 5 findings with source links. All allowed.
  3. Handoff step is visible ("Researcher hands findings to Writer").
  4. Writer drafts the page from the findings (streamed text). Mid-run the script has the Writer try `browser.navigate` to "double check a source". Its browser permission is off, so the server emits a **permission denial**: tool call result with an error, a `CUSTOM permission_denied` event, a red Activity row ("browser.navigate, requested by Writer, denied: browser permission disabled"), and a toast. The Writer continues using only the Researcher's notes.
  5. Review before saving: run ends with an interrupt. UI shows an **Approve & save / Decline** card. Approve saves the page into the Space (in-memory or localStorage) and opens it in the editor. Decline ends with no page.
- **Permissions are enforced server-side in the agent route**, not just hidden in the UI. Flipping a toggle changes the next run: e.g. enable Writer browser and the same script now passes; disable Researcher browser and the Researcher gets denied and falls back to "no sources" findings.
- **Editable page**: a simple editor (textarea with Markdown preview, or a contenteditable block) with title, body, source links, "edited" indicator, and autosave to localStorage. No rich editor dependency needed.
- **Simulated computer**: no Docker, no real browser, no shell. Each tool returns canned output from `data/`. The Activity log mirrors upstream: action, requester, allowed or denied, no file contents or full commands.
- **AG-UI over real SSE**: `POST /api/agent` accepts a `RunAgentInput`-shaped body (plus the per-Dot permissions in `state` or `forwardedProps`) and streams real AG-UI events as `text/event-stream`. The scripted agent paces events with small delays so streaming is visible. This route must work on Vercel with zero secrets.
- **Scripted / no-key path first.** The default demo uses zero API keys and zero external network calls.
- **Optional live mode (only if easy):** if `ANTHROPIC_API_KEY` is set (same env pattern as sibling apps `claude-code-mods` and `claude-agent-loops`), the Writer's page text and the Researcher's findings summary can be generated by Claude, still emitted as AG-UI events and still gated by the same permission check. Tool outputs stay simulated. Without a key, show a small "Scripted mode" badge, never an error.
- `bun install && bun run dev` from `apps/opendots-coworkers/` only
- `bunfig.toml` with `[install] minimumReleaseAge = 259200` before any install
- **Vercel-ready**: `.env.example` (all optional), `vercel.json` mirroring sibling apps
- **Finish line (post-merge ship, not this build PR):** live Vercel production URL plus a root README **Live demos** table row (`App | App directory | Public URL | Notes`)

### Canned tasks (ship at least these three, as data under `data/`)
1. **Competitor brief**: "Research three open source agent UI protocols and write a one-page comparison." Writer tries `browser.navigate` and is denied.
2. **Launch notes**: "Collect what changed in the last release and draft launch notes." Writer tries `shell.run git log` and is denied (shell off).
3. **Meeting prep**: "Gather background on a fictional customer and draft a prep page." Researcher tries `files.read ../writer/draft.md` outside its workspace and is denied (path must stay in its own workspace, matching upstream).

Each task is data: steps per Dot, tool calls with args, canned tool outputs, findings, page draft, and the scripted denied action. Adding a task is a file edit.

## Explicitly out of scope
- Running real OpenDots, OpenBot, CopilotKit Intelligence, Docker, containers, a real browser, or a real shell
- Slack, voice calls, MCP connections, scheduled background work, Automatic Learning
- Multi-user auth, shared editing, real Spaces database (localStorage is enough)
- Real web search or fetching third-party sites (sources in the canned data are static strings)
- Duplicating sibling demos (`claude-code-mods` is hook deny/rewrite for one agent; this app is per-coworker permissions and AG-UI streaming across two Dots)
- Creating a new GitHub repo (build only under this monorepo path)
- Creating the Vercel project or editing root README Live demos in this build PR (parent ships after merge)
- Baking any API keys or `.env` into the tree or build artifacts

## Outcome-oriented tasks
1. Scaffold **Next.js (App Router)** with Bun. Initialize shadcn/ui (minimalist). Write `bunfig.toml` with `minimumReleaseAge = 259200` **before** any install
2. `src/lib/agui.ts`: local TypeScript types for the AG-UI events listed above (SCREAMING_SNAKE_CASE `type` values matching the spec), an SSE encoder for the route, and an SSE reader for the client. Using `@ag-ui/core` / `@ag-ui/client` is optional; only add them if they install cleanly under the release-age gate. Local types are fine
3. `data/dots.json` (two Dots: role, instructions, default permissions, default Space) and `data/tasks/*.json` (canned tasks)
4. `POST /api/agent`: scripted agent that walks a task, wraps each Dot in `SUBAGENT_STARTED/FINISHED`, emits steps, text, tool calls, `ACTIVITY_SNAPSHOT/DELTA` for the computer panel, `STATE_DELTA` for findings and page draft, and ends with an interrupt for review. Permission check runs on every tool call; a denied call emits an error `TOOL_CALL_RESULT` plus `CUSTOM permission_denied`
5. Resume path: Approve or Decline posts a new run with `resume`; Approve emits the saved page (state snapshot) and `RUN_FINISHED` success
6. UI: Dots roster with permission toggles, task picker, live timeline grouped by Dot, raw event view, simulated computer tabs, denial toasts and red activity rows, review card, editable page with localStorage autosave
7. Optional live mode behind `ANTHROPIC_API_KEY` (only if easy; skip if it adds risk). Clear "Scripted mode" badge without a key
8. README: how to run, how the AG-UI stream maps to the UI, how permissions are enforced, a note that computers are simulated because real OpenDots computers need Docker. Attribute OpenDots (CopilotKit, MIT) and the bookmark
9. A few unit tests for the permission gate and the SSE encoder are welcome (bun test)
10. Validation: at least one screenshot and one short video of the running app (hosted off-repo) showing a run with a visible permission denial and the saved editable page. Link both in the PR. Commit no media
11. Move this pick from `proposed` to `built` in `tracking/seen-bookmarks.json` (keep slug `opendots-coworkers`, id `2105710796198322659`)
12. After merge: Vercel project (root dir `apps/opendots-coworkers/`) plus README Live demos table row. Not part of this build PR. Finish line is the production URL in that table

## Stack
- Bun: runtime, package manager, scripts (monorepo default per AGENTS.md)
- Next.js (App Router): one page plus a streaming route handler for SSE on Vercel
- shadcn/ui + Tailwind: minimal UI primitives (cards, tabs, switch, badge, toast, dialog), matches sibling demos
- AG-UI event shapes in local TypeScript: real protocol vocabulary without a runtime dependency
- localStorage: the "Space" that holds saved pages
- Vercel: shareable host (`vercel.json`; zero-secret production path)

## Env (document in `.env.example` + README)
- No required secrets
- Optional: `ANTHROPIC_API_KEY`, `ANTHROPIC_WORKSPACE_ID`, `ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT`, read server-side only, same pattern as `apps/claude-code-mods/.env.example`
- Never add CopilotKit, OpenAI, or Parallel keys

## Reference
- Bookmark: https://x.com/ataiiam/status/2105710796198322659
- OpenDots: https://github.com/CopilotKit/OpenDots (see Background above if unreachable)
- AG-UI docs: https://docs.ag-ui.com/introduction and https://docs.ag-ui.com/concepts/events (see Background above if unreachable)
- Sibling (do not duplicate): `apps/claude-code-mods`
- Monorepo build contract: root `AGENTS.md`

## Deferred
- Real Dot computers via OpenBot on a Docker host
- Real web research and live browsing
- More than two Dots, automatic delegation, group conversation
- MCP connections with Approve & run cards
- Slack and voice surfaces
- Persisted Spaces across devices

---

## Build instruction (Claude Code routine)

Build this demo end-to-end under `apps/opendots-coworkers/` in the existing GitHub repo **chizhangucb/demo-apps** (do NOT create a new repo). Follow root `AGENTS.md` and this PLAN.md verbatim.

**Angle (must ship):** Single-user Next/Bun Vercel playground for OpenDots coworkers. Two Dots, a Researcher and a Writer, each with its own permissions and simulated computer. The user hands them a task; Researcher findings stream in over AG-UI (real SSE from `/api/agent`); the Writer turns them into an editable page after an Approve & save review. When a Dot tries something it is not allowed to do (e.g. the Writer opening the browser), the server denies it and the UI shows a visible permission denial. No Docker: the computer is a simulated action log. Scripted/no-key path first.

Required outcomes:
1. Implement the MVP in `apps/opendots-coworkers/` only (Bun + Next.js App Router + shadcn; `bunfig.toml` with `minimumReleaseAge = 259200` before install; `bun install && bun run dev`).
2. Scripted/no-key demo path: at least the three canned tasks, per-Dot permission toggles enforced server-side, AG-UI event timeline grouped by Dot with a raw event view, simulated computer panel with activity log, visible permission denial, review card, editable page with autosave. Optional live Anthropic behind env only if easy; clear "Scripted mode" badge without a key.
3. Open one PR to `main` on branch `demo-opendots-coworkers` with a one-paragraph summary plus links to at least one screenshot and one short video (hosted off-repo; commit no media).
4. Update `tracking/seen-bookmarks.json`: move pick id `2105710796198322659` (slug `opendots-coworkers`) from `proposed` to `built`.
5. Vercel-ready (`.env.example`, `vercel.json`). Attribute OpenDots (https://github.com/CopilotKit/OpenDots, CopilotKit, MIT) and the bookmark https://x.com/ataiiam/status/2105710796198322659. Do **not** create the Vercel project or edit root README Live demos in this PR.
6. Do **not** create a new GitHub repository. Stay inside `apps/opendots-coworkers/` (plus the bookmark tracking update). Never touch sibling apps.
7. If any link in this PLAN fails, use the Background section above and do not search elsewhere.
