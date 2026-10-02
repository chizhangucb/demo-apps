# Claude Code Mods Playground

A single-page Bun + Next.js playground for **Claude Code mods**
([announcement](https://claude.com/blog/claude-code-mods), via
[@ClaudeDevs](https://x.com/ClaudeDevs/status/2105721434807083061)): edit a tiny `register(on)` mod, fire sample engine
events, and watch the mod **deny**, **rewrite**, or **pass through** each one live.

1. **Mod** — pick a starter (`bash-guard`, `prompt-polish`, `spinner-counter`, or `blank`) and edit it. The editor holds
   one hooks module in the shape the [mods docs](https://code.claude.com/docs/en/plugins/mods/overview) use:
   `export function register(on)` and `on(event, [matcher], async ($, e, next) => …)`.
2. **Event** — pick a sample event (`tool.call` for Bash/Edit, `tool.check`, `prompt.submit`, `ui.render` for the
   Spinner), tweak its JSON if you like, and hit **Fire event** (or **Fire all samples**).
3. **Outcome** — a Deny / Rewrite / Pass-through / Answered badge, what the event looked like going in, what reached
   Claude Code's (simulated) own behavior, the result handed back, a terminal-style preview, and the middleware trace
   (`hook runs → $.ui.log → next(e) with a rewritten event → engine → returned`). Every fire also lands in the
   **Timeline**.

This is a playground, **not** a Claude Code install. There's no Claude Code CLI, plugin runtime, or marketplace here:
the mods API (`$`) and Claude Code's own behavior at the end of the chain are simulated.

## Run

```bash
bun install
bun run dev   # http://localhost:3000
bun test      # every starter mod × every sample event against its fixture outcome
```

## How the harness works

- **Sandboxed.** Your source is compiled with [sucrase](https://github.com/alangpierce/sucrase) (TypeScript → JS) and
  evaluated in a dedicated Web Worker with `fetch`, `XMLHttpRequest`, `WebSocket`, `importScripts`, `indexedDB` and
  friends removed first. It has no DOM and no page state. A watchdog terminates the worker if a fire takes longer than
  2.5s, so a `while (true)` can't freeze the page.
- **Claude Code–shaped.** Hooks form a middleware chain in registration order; `next(e)` calls the next hook or the
  simulated engine. Events are deep-frozen (assigning to `e` throws). Matchers take values, arrays, or regexes. A hook
  that throws or times out before `next` is skipped; `.catch(handler)` lets it fail closed. Registering the same event
  twice without a matcher fails to load, as in Claude Code.
- **Outcome rules.** `{ deny }`, `{ drop }`, or `{ decision: 'deny' }` → **Deny**. Returned without reaching the engine →
  **Answered**. `next` called with a changed event, or the result changed on the way back → **Rewrite**. Otherwise →
  **Pass-through**.
- **Fallback.** If your edit doesn't compile or `register` throws, the error is shown and the playground falls back to
  the seeded starter you began from, so firing still shows an outcome.
- **Simulated `$`.** `$.ui.log`, `$.ui.invalidate`, `$.ui.toast`, `$.ui.ask` (answers with the first/last option or
  dismisses, per the picker), and `$.process.run` (`git branch --show-current` → `main`). Any other `$` call is logged
  as "not simulated" and returns `undefined`.
- **State.** Module-level variables survive between fires (the `spinner-counter` count climbs) until you reload or edit
  the mod.

## Seeded data (`data/`)

| Starter mod | Shows | Hooks |
| --- | --- | --- |
| `bash-guard` | deny | `tool.call {tool: Bash}` refuses force pushes / `rm -rf`; `tool.check {tool: Bash}` refuses `git push` on `main` |
| `prompt-polish` | rewrite | `tool.call {tool: Bash}` swaps npm → bun; `prompt.submit` trims and adds the branch as context for PR asks |
| `spinner-counter` | pass-through + UI rewrite | The docs' first mod: counts `tool.call`s and adds the count beside the Spinner on `ui.render` |

`data/events.ts` has 8 sample events (Bash force push, `rm -rf`, `npm install`, `ls`, an Edit, a `tool.check`, a
`prompt.submit`, a Spinner `ui.render`), each with the simulated engine result and the expected outcome per starter.
The outcome card shows `fixture expects … ✓` while a starter is unedited.

## Modes

| Mode | Needs | What it adds |
| --- | --- | --- |
| Scripted (default) | nothing | Everything above — the default Vercel demo needs no secrets |
| Live | `ANTHROPIC_API_KEY` on the server | **Suggest a mod with Claude**: `/api/suggest` asks Claude to draft a `register(on)` module for your intent and the selected event. The draft lands in the editor and still runs only in the local sandbox. |

Without a key the page shows a "Scripted mode" banner and the Suggest button is disabled. See `.env.example` for
`ANTHROPIC_API_KEY`, `ANTHROPIC_WORKSPACE_ID` (for keys not scoped to one workspace), `ANTHROPIC_MODEL` and
`ANTHROPIC_EFFORT`. Keys are read server-side only.

## Deploy (Vercel)

Import the repo with **Root Directory** `apps/claude-code-mods/`. `vercel.json` sets `bun install` / `bun run build`.
Add `ANTHROPIC_API_KEY` only if you want the live Suggest button.

## Credits

- [Claude Code mods](https://claude.com/blog/claude-code-mods) and the
  [mods docs](https://code.claude.com/docs/en/plugins/mods/overview) by Anthropic — the hook contract and the
  `spinner-counter` / force-push examples are adapted from them.
- Bookmark: https://x.com/ClaudeDevs/status/2105721434807083061
