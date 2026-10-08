# HarnessRouter playground

Single-user playground for [HarnessRouter](https://github.com/HarnessRouter/harnessrouter) and the [Unified Harness Protocol (UHP)](https://unifiedharnessprotocol.org). Pick one to four agent harnesses (Codex, Claude Code, Hermes, Pi), send them the **same Responses-compatible request** (only `metadata.harness_id` changes) and watch each run stream back side by side as its own session: tool calls, files, artifacts, cancellation and follow-ups.

Real HarnessRouter runs harness CLIs inside Docker, which Vercel cannot host. So this app ships a **scripted UHP server** as Next.js route handlers under `/api/uhp/v1/...` with real HTTP and real SSE. The harnesses are simulated from JSON in `data/`. Nothing calls a real harness, shell or model.

Inspired by HarnessRouter (Apache-2.0) via [this bookmark](https://x.com/akshay_pachaar/status/2100888166219886818). Protocol vocabulary follows UHP `2026-10-04`.

## Run

```bash
bun install
bun run dev      # http://localhost:3000
bun run test     # engine + request-handling tests
bun run lint
```

No secrets needed. The header shows a **Scripted harnesses** badge.

## Try it

1. Keep Codex, Claude Code and Hermes ticked (tick Pi too), choose **Fix a failing test** and press **Compare on N harnesses**. One `POST /api/uhp/v1/responses` per harness, same body. The **Request body** card highlights the only per-harness line.
2. Watch the columns: Codex streams a reasoning summary and `shell`/`apply_patch`, Claude Code takes the most steps with `TodoWrite`/`Read`/`Edit`/`Bash`, Hermes loads a skill and reports `usage: null`, Pi is fastest with four tools. The **Differences** table sums it up.
3. Open **Files** in a column: preview or download `fix.patch` (served with `X-Content-Type-Options: nosniff`).
4. Open **Raw SSE**: every event's `sequence_number` and `type`, click one for its JSON, and a "no gaps" badge.
5. Choose **Research brief (long)**, run, and press **Cancel** on one column (or **Cancel all**). The run ends `cancelled`, partial output stays, and **Follow-up** on that column continues the same session (same `session_id`, `previous_response_id` set).
6. **Continue this session on <other harness>** sends a follow-up with a different `harness_id`: you get the `409 harness_mismatch` error envelope as a card.
7. Set `max_step` to `2` and run: every harness ends `incomplete` (`incomplete_details.reason: "max_step"`), never `completed`.
8. Type `gpt-5.4` in **model override**: Codex runs it, Claude Code and Pi substitute their default and say so (`metadata.model_fallback`, `requested_model`, `model_fallback_reason`), Hermes refuses with `422 model_unavailable`.
9. Toggle **send `tools: []`**: the response lists it in `metadata.ignored_fields`.

## curl, like upstream

Point `HARNESSROUTER_BASE_URL` at the app. The scripted server accepts requests without a bearer token; a real HarnessRouter needs `Authorization: Bearer $HARNESSROUTER_API_KEY`.

```bash
export HARNESSROUTER_BASE_URL=http://localhost:3000/api/uhp

curl -s $HARNESSROUTER_BASE_URL/v1/harnesses

curl -N $HARNESSROUTER_BASE_URL/v1/responses \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Summarise README.md in three bullets and save summary.md.",
    "model": "claude-sonnet-4.6",
    "metadata": { "harness_id": "chrn_08dae611630d467ab3e67ed792570ae5" },
    "stream": true
  }'

curl -s -X POST $HARNESSROUTER_BASE_URL/v1/responses/$RESPONSE_ID/cancel
curl -s $HARNESSROUTER_BASE_URL/v1/responses/$RESPONSE_ID
```

The scripted server needs to know which canned task to replay: it reads `metadata.task_id` (`summarise-readme`, `fix-failing-test`, `research-brief`), else matches the input text to a task prompt, else uses the first task.

### Routes

| Route | Notes |
| --- | --- |
| `GET /v1/uhp` | discovery; unsupported capabilities reported `false` |
| `GET /v1/harnesses`, `GET /v1/harnesses/{id}/models` | from `data/harnesses.json` |
| `POST /v1/responses` | `stream: true` gives SSE; otherwise blocks and returns the same final response (`background: true` returns at once) |
| `GET /v1/responses/{id}` | stored response, rebuilt from the id |
| `POST /v1/responses/{id}/cancel` | idempotent; a terminal response is returned unchanged |
| `GET /v1/sessions/{id}`, `/turns`, `/files` | accept `?latest=<response id>` (see below) |
| `GET /v1/containers/{cid}/files/{fid}/content` | artifact bytes with `Content-Type`, `Content-Disposition`, `X-Content-Type-Options: nosniff` |

Every non-2xx response carries the `{ "error": { type, code, message, param, detail } }` envelope, unknown routes included, and every response carries `UHP-Version: 2026-10-04`.

## How the SSE events map to the UI

| Event | UI |
| --- | --- |
| `response.created` / `response.in_progress` | column appears, status pill `in_progress`, metadata panel (session, model, fallback, ignored fields) |
| `response.output_item.added` / `.done` | a row per item: reasoning, tool call, tool output, assistant message |
| `response.reasoning_summary_*` | italic "reasoning summary" box (Codex, Hermes) |
| `response.function_call_arguments.delta` / `.done` | tool-call args stream into the row |
| `response.content_part.*`, `response.output_text.delta` / `.done` | assistant text streams in |
| `response.output_text.annotation.added` | `container_file_citation` chips; the Files tab reloads `GET /v1/sessions/{id}/files` |
| `response.completed` / `response.incomplete` / `response.failed` | final status pill; `response.failed` with `status: "cancelled"` is a cancel, not a failure |

The browser folds events with the same reducer the server uses to rebuild responses (`src/lib/uhp/reduce.ts`).

## How cancel works on Vercel

Serverless instances do not share memory, so the stream and the cancel call may land on different instances.

- **Deterministic response ids.** A response id encodes harness, task, session and every turn's start time, model, budget and ignored fields (`src/lib/uhp/ids.ts`). Any instance can rebuild the response at any instant from the id and the clock, so `GET /v1/responses/{id}` works without a database.
- **Warm path.** A module-level registry records the cancel point. The stream loop checks it every tick and emits closing events: unfinished items are closed `incomplete`, then `response.failed` with `status: "cancelled"`. The cancel reply is built from the same cut, so both agree.
- **Cold path.** After a 200 from cancel, the client waits up to 1s for that terminal event. If it does not come (the stream lives on another instance), the client closes the reader and renders the response returned by the cancel call. The stored response is the source of truth; the stream is an optimisation.
- Sessions and their turns live in `localStorage`, so reloads and cold starts keep them. Session reads accept `?latest=<response id>`, a scripted-server hint: the latest id encodes every turn of the session, so files and turns can be listed on a cold instance too.

## Data, not code

- `data/harnesses.json`: four harnesses (`chrn_...` ids, base, default model, models with `available`, what happens on an unavailable model, and a style profile: tools, reasoning, usage reporting, pace, delta size).
- `data/tasks/*.json`: three tasks. Each has a per-harness script (reasoning summary or none, tool calls with args and canned outputs, final text, artifacts) and a follow-up script ("Now make it shorter.") that adds a new artifact to the same session.

Adding a harness or a task is a JSON edit. The engine (`src/lib/uhp/engine.ts`) turns a script into ordered, timed events: created first, each item added before its deltas and done after them, exactly one terminal event, gapless `sequence_number`.

## Optional live text

The PLAN allowed Claude-written final text behind `ANTHROPIC_API_KEY` "only if easy". It is left out on purpose: cancel and `GET /v1/responses/{id}` rebuild responses deterministically from the id, and model-written text would make the rebuilt response differ from what was streamed. No keys are read anywhere.

## Deploy (Vercel)

Root Directory `apps/harness-router`, framework Next.js, install `bun install`, build `bun run build` (`vercel.json`). No environment variables. SSE routes use the Node runtime, `dynamic = "force-dynamic"`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`, and `maxDuration = 60` (the longest script runs about 20s).

## Not here

No Docker, Runner, real harness CLIs, workspaces or shell; no live proxy to a real UHP server; no multipart `/v1/files` uploads, plugins, memories, harness management, session sharing or idempotency keys. Siblings cover single harnesses: `pi-jev-harness`, `hermes-skill-loop`, `claude-agent-loops`. This app is about one protocol across many harnesses.

## Attribution

- [HarnessRouter](https://github.com/HarnessRouter/harnessrouter), Apache-2.0. This app reimplements a scripted subset of its API; no upstream code is copied.
- [Unified Harness Protocol](https://unifiedharnessprotocol.org), version `2026-10-04`.
- Bookmark: [@akshay_pachaar, "Run Any Agent Harness Under One Interface"](https://x.com/akshay_pachaar/status/2100888166219886818).
- Harness names (Codex, Claude Code, Hermes, Pi) belong to their owners; tool names and models in `data/` only illustrate each harness's style.
