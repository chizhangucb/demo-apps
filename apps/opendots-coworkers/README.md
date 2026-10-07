# OpenDots coworkers playground

Single-user playground for [OpenDots](https://github.com/CopilotKit/OpenDots)-style AI coworkers. Two Dots, a **Researcher** and a **Writer**, each have their own role, permissions and simulated computer. Hand them a task: the Researcher's findings stream in over **AG-UI** (real SSE from `POST /api/agent`), the Writer drafts a page, the run pauses on an **Approve & save / Decline** review, and the approved page opens in an editor that autosaves. When a Dot tries something it isn't allowed to do, the server denies it and the UI shows the denial.

Inspired by CopilotKit's OpenDots template (MIT) via [this bookmark](https://x.com/ataiiam/status/2105710796198322659). This is not OpenDots itself: there is no CopilotKit runtime, OpenBot or Docker.

## Run

```bash
bun install
bun run dev      # http://localhost:3000
bun test         # permission gate, SSE encoder/reader, scripted runs
```

No secrets needed. Without `ANTHROPIC_API_KEY` the header shows a **Scripted mode** badge and everything runs from `data/`. With a key (see `.env.example`), Claude writes the Writer's page body; it is still streamed as AG-UI events and tool calls stay simulated and gated.

## Try it

1. Press **Run** on *Competitor brief*. The Writer tries `browser.navigate`, its browser permission is off, and you get a denied tool call, a red Activity row on the Writer's computer and a toast.
2. **Approve & save** the draft. It lands in the Drafts Space (localStorage) and opens in the editor. Edit it; it autosaves.
3. Flip toggles and rerun: turn the Writer's browser on and the same script passes; turn the Researcher's browser off and its findings come back with no sources; turn the Writer's *Save page* off and approval is denied.
4. *Launch notes* has the Writer try `shell.run git log` (shell off). *Meeting prep* has the Researcher try `files.read ../writer/draft.md` (outside its workspace).
5. Toggle **Raw events** to see every AG-UI event's `type` and JSON.

## How the AG-UI stream maps to the UI

`POST /api/agent` takes a `RunAgentInput` (`threadId`, `runId`, `messages`, `state`, `forwardedProps: { taskId, permissions }`, optional `resume`) and returns `text/event-stream`, one JSON event per `data:` line. Types are local (`src/lib/agui.ts`), using the spec's SCREAMING_SNAKE_CASE names.

| Event | UI |
| --- | --- |
| `RUN_STARTED` / `RUN_FINISHED` / `RUN_ERROR` | run status; `RUN_FINISHED` with `outcome: { type: "interrupt" }` shows the review card |
| `SUBAGENT_STARTED` / `SUBAGENT_FINISHED` | one subagent run per Dot; every event carries `subagentRunId`, so the timeline groups by Dot |
| `STEP_STARTED` / `STEP_FINISHED` | step markers (`research`, `handoff`, `draft`, `review`) |
| `TEXT_MESSAGE_START` / `CONTENT` / `END` | streamed Dot text and the page draft |
| `TOOL_CALL_START` / `ARGS` / `END` / `RESULT` | tool call rows with args and result (error JSON when denied) |
| `ACTIVITY_SNAPSHOT` / `ACTIVITY_DELTA` | each Dot's simulated computer: browser, files, terminal, Activity log (JSON Patch) |
| `STATE_SNAPSHOT` / `STATE_DELTA` | shared run state: findings, draft, saved page |
| `CUSTOM permission_denied` | red denial row, toast, red dot on that computer tab |
| `CUSTOM handoff` | the visible Researcher → Writer handoff |

Approve or Decline posts a new run with `resume: [{ interruptId, status }]` and the current `state`.

## How permissions are enforced

Toggles are sent in `forwardedProps.permissions` on every run. The route normalizes them (anything not exactly `true` is off, as upstream Dots start disabled) and `checkTool()` in `src/lib/permissions.ts` runs on **every** simulated tool call, including `page.save` on approval. File tools also require a relative path inside the Dot's own workspace. A denied call never runs; it emits an error `TOOL_CALL_RESULT`, `CUSTOM permission_denied` and a denied Activity row. Like upstream, the Activity log records action, requester and outcome only, never file contents or full commands.

## Why the computers are simulated

Real OpenDots computers are Docker containers driven by OpenBot, which Vercel cannot host. Here each tool returns canned output from `data/tasks/*.json`: no browser, no shell, no external network calls.

## Layout

- `data/dots.json`: the two Dots (role, instructions, default permissions, Space)
- `data/tasks/*.json`: canned tasks (steps per Dot, tool args and outputs, findings, page draft, scripted denial). Add a file and list it in `src/lib/catalog.ts`.
- `src/server/agent.ts`: the scripted agent (async generator of AG-UI events)
- `src/app/api/agent/route.ts`: SSE route
- `src/lib/run-view.ts`: pure reducer from events to UI state
- `src/components/dots/*`: roster, timeline, computer panel, review card, page editor

## Deploy

Vercel project with Root Directory `apps/opendots-coworkers/` (`vercel.json` uses Bun). Works with zero env vars.

## Attribution

[OpenDots](https://github.com/CopilotKit/OpenDots) by CopilotKit, MIT. AG-UI protocol: [docs.ag-ui.com](https://docs.ag-ui.com). Source bookmark: https://x.com/ataiiam/status/2105710796198322659
