# harness-router

## Goal
Single-user **HarnessRouter playground**: pick one or more agent harnesses (Codex, Claude Code, Hermes, Pi), submit the **same task with the same request shape**, and watch each run as a streamed session with its tool calls, files, and artifacts. The point is the **Unified Harness Protocol (UHP)**: one Responses-compatible API where only `metadata.harness_id` changes, while per-harness differences (tools, reasoning, models, usage, artifacts) stay visible. Cancellation and session follow-ups work. Inspired by HarnessRouter, the open source "OpenRouter for agent harnesses".

Source bookmark: https://x.com/akshay_pachaar/status/2100888166219886818 (Akshay, "Run Any Agent Harness Under One Interface")
Upstream: https://github.com/HarnessRouter/harnessrouter (HarnessRouter Community Edition, Apache-2.0). Protocol: https://unifiedharnessprotocol.org

## Background (embedded so the build does not depend on external links)

If any link in this PLAN fails to load, use this section as the source of truth. Do not search elsewhere.

### HarnessRouter in short (from the upstream README, Oct 2026)
- **What it is:** a self-hosted, Apache-2.0 "unified interface for agent harnesses". It turns existing harnesses (Codex, Claude Code, Hermes, Pi, DeepSeek Harness, Gemini CLI, and more) into pluggable agent backends behind **one OpenAI Responses-compatible API**, with persistent sessions, streaming progress, files, artifacts, cancellation, and structured failures. Also offered as a managed Cloud with the same API contract.
- **How it runs:** one Docker container. Console :3000 (only published port) proxies to a Gateway :8080 (Responses API plus harness lifecycle), which drives a Runner :8081 that runs harness CLIs in per-session workspaces. A `/data` volume holds database, files, secrets, workspaces. Docker cannot run on Vercel, so **this demo simulates the server and the harnesses**.
- **API base:** `HARNESSROUTER_BASE_URL=http://localhost:3000/api/harness`, then `POST $HARNESSROUTER_BASE_URL/v1/responses` with `Authorization: Bearer $HARNESSROUTER_API_KEY`. The harness is picked with `metadata.harness_id`. Full API at `/v1/openapi.json`.
- **App lifecycle in one table:** start tasks, continue sessions (`previous_response_id`), stream progress (`stream: true`), work with files (input files in, artifacts out), cancel tasks, inspect structured errors and traces.
- **Harness vs model API:** a model API gives you a *turn* (messages in, tokens out, you run the tools). UHP gives you a *task*: work in, a running agent uses its own tools, keeps its own session, and hands back results and files.

### UHP essentials (spec version `2026-10-04`)

**Run a task:** `POST /v1/responses`
```json
{
  "input": "Summarise README.md in three bullets.",
  "model": "claude-sonnet-4.6",
  "metadata": { "harness_id": "chrn_08dae611630d467ab3e67ed792570ae5" },
  "stream": true
}
```
Request fields: `input` (string, or array of items; required), `model` (optional canonical id, omitted means harness default), `metadata` (`harness_id` selects the harness), `stream` (bool), `previous_response_id` (continue a session), `instructions`, `store` (default true), `max_output_tokens`, `max_step` (step budget), `timeout_seconds`, `background`. `tools` and `include` are **reserved and ignored**. Rules:
- Unknown fields are ignored, and **ignoring must be observable**: the response lists them in `metadata.ignored_fields`. A request carrying `tools` or `include` always gets them listed there.
- No `harness_id` means the server uses a default harness and reports which in response `metadata`. Unknown harness: `404 harness_not_found`. `previous_response_id` plus a different `harness_id`: `409 harness_mismatch`.
- **Model substitution must be visible.** If the requested model cannot run on that harness, the server either fails `422 model_unavailable` or substitutes the default and reports `metadata.requested_model`, `metadata.model_fallback: true`, `metadata.model_fallback_reason`. Response `model` is what actually ran.
- Budgets (`max_step`, `timeout_seconds`) end the task as `incomplete`, never `completed`.

**Input items:** `input_text`, `input_file` (inline `file_data` data URL with `filename`, or `file_id` from `POST /v1/files`), `input_image`. Example:
```json
{ "input": [ { "role": "user", "content": [
  { "type": "input_text", "text": "Summarise this report." },
  { "type": "input_file", "filename": "q3.pdf", "file_data": "data:application/pdf;base64,..." } ] } ] }
```

**Response object:**
```json
{
  "id": "resp_a1b2c3", "object": "response", "created_at": 1786400000,
  "status": "completed", "error": null, "incomplete_details": null,
  "previous_response_id": null, "model": "claude-sonnet-4.6",
  "output": [
    { "id": "rs_1", "type": "reasoning", "summary": [ { "type": "summary_text", "text": "..." } ], "status": "completed" },
    { "id": "fc_1", "type": "function_call", "call_id": "call_1", "name": "read_file", "arguments": "{\"path\":\"README.md\"}", "status": "completed" },
    { "id": "fco_1", "type": "function_call_output", "call_id": "call_1", "output": "...", "status": "completed" },
    { "id": "msg_1", "type": "message", "role": "assistant", "status": "completed",
      "content": [ { "type": "output_text", "text": "- ...", "annotations": [] } ] }
  ],
  "store": true,
  "usage": { "input_tokens": 5120, "output_tokens": 240, "total_tokens": 5360 },
  "metadata": { "session_id": "hsess7e78..." }
}
```
`id` is `resp_`-prefixed. `metadata.session_id` is required. `usage` is `null` when the server cannot account for it, **never a fabricated zero**. `error` is non-null only when `status` is `failed`. Output item types: `message`, `reasoning` (optional summary, many harnesses emit none), `function_call` (the harness ran a tool; `arguments` is a JSON string), `function_call_output` (matched by `call_id`). The harness executes its own tools; they are reported as observability, never sent back by the client. Clients must tolerate unknown item types.

**Statuses:** `in_progress` then exactly one terminal: `completed`, `failed` (has `error`), `incomplete` (budget hit, partial output), `cancelled` (client asked; partial output kept). No transitions out of a terminal state.

**Streaming (SSE):** `Content-Type: text/event-stream`, `Cache-Control: no-cache`. Each message is `data: {json}` with `type` and `sequence_number` (starts at 0, +1 per event, no gaps, so a client can detect a dropped event). Never buffer to the end. Keep-alive comment `: keep-alive` at least every 30s. Event vocabulary:
- Lifecycle: `response.created` (first event, carries `response` with `status: in_progress`), `response.in_progress`, terminal `response.completed` / `response.incomplete` / `response.failed`, each carrying the full final `response`.
- Items: `response.output_item.added` (`output_index`, shell `item`), `response.output_item.done` (complete `item`). `added` precedes every event about that item, `done` follows them all.
- Text: `response.content_part.added`, `response.output_text.delta` (`item_id`, `output_index`, `content_index`, `delta`), `response.output_text.done` (`text`), `response.content_part.done` (`part`), `response.output_text.annotation.added` (`annotation`, an artifact citation).
- Reasoning: `response.reasoning_summary_part.added`, `response.reasoning_summary_text.delta`, `response.reasoning_summary_part.done`.
- Tools: `response.function_call_arguments.delta`, `response.function_call_arguments.done` (`arguments`). The call is an output item of type `function_call`, its result a `function_call_output` item.
- Errors: `error` (`code`, `message`, `param`) for a non-fatal error, always followed by a terminal event.
- **A cancelled task ends with `response.failed` whose `response.status` is `"cancelled"`.** The status field, not the event name, is authoritative.
- A dropped connection does not abort the task. The stored response (`GET /v1/responses/{id}`) is the source of truth; the stream is an optimisation.

**Sessions:** the first task creates a session implicitly (`metadata.session_id`). Continue with `{"input": "...", "previous_response_id": "resp_..."}`: same session id, same working directory and files, same harness, conversation context kept. `model` may change per task. One task at a time per session: a second concurrent task gets `409 session_busy`. Reads: `GET /v1/sessions`, `GET /v1/sessions/{id}`, `GET /v1/sessions/{id}/turns` (each turn has `id` = response id and `status`, plus `user`, `assistant`, `tools`, `files` when available).

**Cancel:** `POST /v1/responses/{response_id}/cancel` (this task) or `POST /v1/sessions/{session_id}/cancel` (whatever runs in the session). Should answer within 1s. Ends `status: "cancelled"`, never `failed`. Output produced before the cancel is kept. Cancelling an already terminal task succeeds and changes nothing. Cancel never deletes the session; it stays continuable.

**Files and artifacts:** upload with `POST /v1/files` (multipart) returns `{ "id": "file_abc123", "object": "file", "filename": "q3.pdf", "bytes": 184320, "created_at": ... }`; oversized uploads get `413 file_too_large`. Produced files appear as annotations on the assistant message:
```json
{ "type": "container_file_citation", "container_id": "cntr_...", "file_id": "file_...",
  "filename": "report.md", "download_url": "https://server/v1/containers/cntr_.../files/file_.../content",
  "start_index": 0, "end_index": 24 }
```
and in `GET /v1/sessions/{session_id}/files` -> `{ "files": [ { "id", "container_id", "filename", "bytes", "created_at" } ] }` (every artifact of the session, earlier tasks included). Download raw bytes at `GET /v1/containers/{container_id}/files/{file_id}/content` with the file's own `Content-Type`, `Content-Disposition` with the filename, and **`X-Content-Type-Options: nosniff`** (artifacts are attacker-influenced). Bulk: `GET /v1/sessions/{id}/files/archive`.

**Harnesses and discovery:** `GET /v1/uhp` (no auth) returns `{ "object": "uhp.discovery", "protocol": "uhp", "versions": [...], "default_version": "2026-10-04", "conformance_class": "core|extended|full", "capabilities": { "streaming", "sessions", "cancellation", "files_input", "files_output", "session_listing", "harness_management", "session_sharing", "idempotency", ... } }` (unsupported capabilities are reported `false`, never omitted). `GET /v1/harnesses` returns `{ "harnesses": [ { "id": "chrn_...", "object": "harness", "name", "base": "codex|claude-code|hermes|pi|...", "baseLabel", "defaultModel", "systemPrompt", "mcpServers", "skills", "disabledTools", "maxStep", "timeoutSeconds", "createdAt" } ] }`. Clients treat `base` as an opaque string. `GET /v1/harnesses/{id}/models` lists models with `available` (a promise: true means it can run right now). Clients may send `UHP-Version: 2026-10-04`; every response carries the `UHP-Version` header actually used.

**Error envelope (every non-2xx):** `{ "error": { "type", "code", "message", "param", "detail" } }`. Types: `invalid_request_error` (400/404/409/413/422), `authentication_error` (401), `permission_error` (403), `rate_limit_error` (429), `harness_error` (inside a 200 failed response), `server_error` (5xx). A failed *task* is HTTP 200 with `status: "failed"`; a failed *request* is non-2xx. Codes used here: `harness_not_found`, `response_not_found`, `session_not_found`, `harness_mismatch`, `session_busy`, `model_unavailable`, `file_too_large`, `harness_error`, `cancelled`.

## Single-user MVP
- One sticky App Router page, three regions (stack on narrow screens):
  1. **Request builder**: harness picker (cards for Codex, Claude Code, Hermes, Pi from `GET /v1/harnesses`, each with base, default model, capability chips), task picker (canned) or free text, optional model override, optional input file chip, `max_step` field. Below it, the **exact JSON request body** that will be sent, with only `metadata.harness_id` (and `model` if overridden) highlighted as the per-harness part.
  2. **Session view** per run: live status pill (`in_progress` / `completed` / `incomplete` / `cancelled` / `failed`), rendered output items in order (reasoning summary, tool call with args streaming in, tool output, assistant text streaming), `metadata` panel (session id, model actually run, `requested_model` + fallback reason when substituted, `ignored_fields`, usage or "usage: null"), a **Cancel** button, and a **Follow-up** input that sends `previous_response_id`.
  3. **Files + raw stream**: artifacts from `container_file_citation` annotations and `GET /v1/sessions/{id}/files` with preview and download; a raw SSE tab printing `sequence_number`, `type`, and JSON for each event, with a "no gaps" check badge.
- **Compare mode (the headline):** tick 2 to 4 harnesses and Run. The same request body fans out (one `POST /v1/responses` per harness, differing only in `metadata.harness_id`), and the sessions stream side by side in columns. A small "differences" strip under the columns summarises per harness: tool names used, reasoning yes/no, steps, artifacts, model run, usage, elapsed time.
- **Per-harness differences are data, not code** (`data/harnesses.json`). Make them protocol-visible. Tool names below are illustrative of each harness's style:
  - **Codex** (`base: codex`, default `gpt-5.4`): emits a reasoning summary; tools `shell`, `apply_patch`; fewer, larger text deltas; reports usage.
  - **Claude Code** (`base: claude-code`, default `claude-sonnet-4.6`): no reasoning summary; tools `Read`, `Edit`, `Write`, `Bash`, `TodoWrite`; more steps; reports usage.
  - **Hermes** (`base: hermes`, default a non-Anthropic model id): tools `terminal`, `read_file`, `write_file`, plus a skill call; reports `usage: null` (shows "never a fabricated zero").
  - **Pi** (`base: pi`, default a small fast model): minimal tools `read`, `bash`, `edit`, `write`; fastest pace; fewest steps.
  - Requesting a model a harness cannot serve triggers **substitution** on one harness (response `model` differs, `metadata.model_fallback`) and `422 model_unavailable` on another, both shown in the UI.
- **Cancellation works:** Cancel calls `POST /v1/responses/{id}/cancel`. The stream ends with `response.failed` carrying `status: "cancelled"`, partial output stays rendered, the session stays continuable (a follow-up after cancel works). In compare mode, each column has its own Cancel plus a "Cancel all".
- **Sessions:** follow-up via `previous_response_id` keeps `session_id` and accumulates files (session files list shows earlier artifacts). Trying to continue a session on a *different* harness returns the `409 harness_mismatch` envelope, rendered as an error card.
- **Budgets:** setting `max_step` below a task's step count ends the run `incomplete` with partial output (not `completed`).
- **Ignored fields:** a "send `tools: []` too" toggle shows the server answering with `metadata.ignored_fields: ["tools"]`.
- **Scripted UHP server, real HTTP + SSE.** Implement a scripted, in-process UHP server as Next route handlers under `/api/uhp/v1/...`, so `HARNESSROUTER_BASE_URL=<app>/api/uhp` works from curl exactly like upstream. Minimum routes: `GET /v1/uhp`, `GET /v1/harnesses`, `GET /v1/harnesses/{id}/models`, `POST /v1/responses` (stream and non-stream produce the same `output`), `GET /v1/responses/{id}`, `POST /v1/responses/{id}/cancel`, `GET /v1/sessions/{id}`, `GET /v1/sessions/{id}/turns`, `GET /v1/sessions/{id}/files`, `GET /v1/containers/{cid}/files/{fid}/content`. Error envelope on every non-2xx. `UHP-Version` header on every response. The UI talks to these routes only (no client-side fake stream). The scripted engine paces events with small delays so streaming is visible.
- **Cancel on Vercel (serverless instances do not share memory):** keep a module-level registry the stream loop checks every tick (works locally and on a warm instance), and make the server stateless where it matters: encode harness, task, session, and start time in the response id so `POST /cancel` and `GET /v1/responses/{id}` can rebuild the response deterministically (output up to the elapsed point, `status: "cancelled"` after a cancel). The client, after a 200 from cancel, waits up to 1s for the terminal `response.failed` (status `cancelled`) on the stream; if it does not arrive, it closes the reader and renders the response returned by the cancel call. This matches the spec: the stored response is the source of truth. Persist session history and files client-side (localStorage) so follow-ups survive a cold start; send what the scripted server needs in the request (allowed, since unknown fields are ignored and listed).
- **Scripted / no-key path first.** The default demo uses zero API keys and zero external network calls, and works on Vercel with zero secrets.
- **Optional live text (only if easy):** if `ANTHROPIC_API_KEY` is set (same env pattern as sibling apps `claude-code-mods`, `claude-agent-loops`, `opendots-coworkers`), the final assistant message text for a run can be generated by Claude and streamed as `response.output_text.delta`. Tool calls, files, and harness behaviour stay scripted. Badge reads "Scripted harnesses" without a key and "Scripted harnesses, live text" with one; never an error. Do not add HarnessRouter, OpenAI, or other new keys.
- `bun install && bun run dev` from `apps/harness-router/` only
- `bunfig.toml` with `[install] minimumReleaseAge = 259200` before any install
- **Vercel-ready**: `.env.example` (all optional), `vercel.json` mirroring sibling apps; SSE route handlers use the Node runtime, `dynamic = "force-dynamic"`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`, and a `maxDuration` that covers the longest script
- **Finish line (post-merge ship, not this build PR):** live Vercel production URL plus a root README **Live demos** table row (`App | App directory | Public URL | Notes`)

### Canned tasks (ship at least these three, as data under `data/tasks/`)
1. **Summarise a README**: "Summarise README.md in three bullets and save summary.md." Carries an inline `input_file` (a short sample README). Artifact: `summary.md`. Short, good for compare mode.
2. **Fix a failing test**: "The test in utils.test.ts fails. Fix utils.ts and save the patch." Artifacts: `fix.patch`, `test-output.txt`. Most visible tool differences across harnesses.
3. **Research brief (long)**: "Write a one-page brief comparing three agent harnesses with a CSV of features." Many steps and slow pace, so **Cancel** and **max_step** are easy to demo. Artifacts: `brief.md`, `features.csv`.

Each task is data: per-harness script (reasoning summary or none, tool calls with args and canned outputs, text chunks, artifacts with contents, usage), plus a follow-up script ("Now make it shorter") so session continuation shows the same `session_id` and a new artifact. Adding a task or a harness is a file edit.

## Explicitly out of scope
- Running real HarnessRouter, Docker, the Runner, harness CLIs, real workspaces, or a real shell
- A live proxy to a real UHP server (no sibling key exists; deferred)
- Plugins, environments, memories, MCP servers, skills management, harness create/update, session sharing, idempotency keys, `/v1/files` multipart upload beyond a small inline file
- Multi-user auth (the scripted server accepts requests without a bearer token; the README notes a real server needs `Authorization: Bearer $HARNESSROUTER_API_KEY`)
- Duplicating sibling demos: `pi-jev-harness` (one Pi loop with Jev gates), `hermes-skill-loop` (Hermes skill extraction), `claude-agent-loops` (Claude loop patterns). This app is about one protocol across many harnesses, not any single harness's loop
- Creating a new GitHub repo (build only under this monorepo path)
- Creating the Vercel project or editing root README Live demos in this build PR (parent ships after merge)
- Baking any API keys or `.env` into the tree or build artifacts

## Outcome-oriented tasks
1. Scaffold **Next.js (App Router)** with Bun. Initialize shadcn/ui (minimalist). Write `bunfig.toml` with `minimumReleaseAge = 259200` **before** any install
2. `src/lib/uhp/types.ts`: local TypeScript types for the request, response, output items, SSE events, error envelope, harness, discovery, and file objects above (wire names exactly as in Background). The `openai` SDK is optional for the client side; only add it if it installs cleanly under the release-age gate. Local types plus a small SSE reader are fine
3. `data/harnesses.json` (four harnesses with ids `chrn_...`, base, baseLabel, defaultModel, available models, style profile) and `data/tasks/*.json` (three tasks with per-harness scripts and follow-ups)
4. Scripted engine `src/lib/uhp/engine.ts`: turns (harness, task, request) into an ordered event list that obeys the ordering rules (created first, added before deltas, done after, one terminal event, gapless `sequence_number`), builds the identical final `response` for stream and non-stream, applies model substitution or `model_unavailable`, `ignored_fields`, `max_step` to `incomplete`, and cancel to `cancelled` with partial output
5. Route handlers under `src/app/api/uhp/v1/...` for the routes listed in the MVP, with error envelope, `UHP-Version` header, keep-alive comments, and artifact download headers (`Content-Type`, `Content-Disposition`, `X-Content-Type-Options: nosniff`)
6. UI: harness picker, request JSON preview with the per-harness part highlighted, single and compare runs, session view with live status and metadata, Cancel and Cancel all, follow-up input, harness-mismatch error card, files panel with preview and download, raw SSE tab with gap check, differences strip
7. Optional live text behind `ANTHROPIC_API_KEY` (only if easy; skip if it adds risk). Clear "Scripted harnesses" badge without a key
8. README: how to run; a curl example against `<app>/api/uhp/v1/responses` mirroring the upstream one; how the SSE events map to the UI; how cancel works on Vercel; a note that harnesses are simulated because real HarnessRouter needs Docker. Attribute HarnessRouter (Apache-2.0), UHP, and the bookmark
9. A few unit tests (bun test) for the engine: sequence numbers gapless, exactly one terminal event, stream and non-stream outputs identical, cancel keeps partial output and reports `cancelled`, mismatch returns the 409 envelope
10. Validation: at least one screenshot and one short video of the running app (hosted off-repo) showing a compare run across at least three harnesses, a cancelled run, and a downloaded artifact. Link both in the PR. Commit no media
11. Move this pick from `proposed` to `built` in `tracking/seen-bookmarks.json` (keep slug `harness-router`, id `2100888166219886818`)
12. After merge: Vercel project (root dir `apps/harness-router/`) plus README Live demos table row. Not part of this build PR. Finish line is the production URL in that table

## Stack
- Bun: runtime, package manager, scripts (monorepo default per AGENTS.md)
- Next.js (App Router): one page plus streaming route handlers that act as the scripted UHP server on Vercel
- shadcn/ui + Tailwind: minimal UI primitives (cards, tabs, checkbox, badge, toast, dialog), matches sibling demos
- Local UHP types: real protocol vocabulary without a runtime dependency
- localStorage: session history and artifacts across reloads and cold starts
- Vercel: shareable host (`vercel.json`; zero-secret production path)

## Env (document in `.env.example` + README)
- No required secrets
- Optional: `ANTHROPIC_API_KEY`, `ANTHROPIC_WORKSPACE_ID`, `ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT`, read server-side only, same pattern as `apps/claude-code-mods/.env.example`
- Never add HarnessRouter, OpenAI, OpenRouter, or other provider keys for this app

## Reference
- Bookmark: https://x.com/akshay_pachaar/status/2100888166219886818
- HarnessRouter: https://github.com/HarnessRouter/harnessrouter (see Background above if unreachable)
- UHP spec: https://github.com/HarnessRouter/harnessrouter/tree/main/protocol/versions/2026-10-04 (tasks, streaming, sessions, files, lifecycle, errors, harnesses) and https://unifiedharnessprotocol.org (see Background above if unreachable)
- Siblings (do not duplicate): `apps/pi-jev-harness`, `apps/hermes-skill-loop`, `apps/claude-agent-loops`
- Monorepo build contract: root `AGENTS.md`

## Deferred
- Live proxy mode to a real HarnessRouter or UHP server (`HARNESSROUTER_BASE_URL` + `HARNESSROUTER_API_KEY`)
- Real harness execution, workspaces, and Docker
- `/v1/files` multipart uploads, archives, PDF previews
- Plugins, environments, memories, harness management, session sharing, idempotency
- Running the upstream conformance suite against the scripted server

---

## Build instruction (Claude Code routine)

Build this demo end-to-end under `apps/harness-router/` in the existing GitHub repo **chizhangucb/demo-apps** (do NOT create a new repo). Follow root `AGENTS.md` and this PLAN.md verbatim.

**Angle (must ship):** Single-user Next/Bun Vercel playground for HarnessRouter and the Unified Harness Protocol. Pick one or more harnesses (Codex, Claude Code, Hermes, Pi), submit the same task with the same Responses-compatible request (only `metadata.harness_id` changes), and watch each streamed session with its tool calls, files, and artifacts side by side. Per-harness differences are visible, cancellation works, follow-ups keep the session. The UHP server is scripted inside Next route handlers (`/api/uhp/v1/...`, real SSE). No Docker. Scripted/no-key path first.

Required outcomes:
1. Implement the MVP in `apps/harness-router/` only (Bun + Next.js App Router + shadcn; `bunfig.toml` with `minimumReleaseAge = 259200` before install; `bun install && bun run dev`).
2. Scripted/no-key demo path: four harnesses, at least the three canned tasks, request JSON preview, single and compare runs over real SSE, raw event view with gapless sequence check, visible per-harness differences (tools, reasoning, model substitution, usage null), working Cancel (status `cancelled`, partial output kept), session follow-up with `previous_response_id`, `harness_mismatch` error card, files panel with download. Optional live text via `ANTHROPIC_API_KEY` only if easy; clear "Scripted harnesses" badge without a key.
3. Open one PR to `main` on branch `demo-harness-router` with a one-paragraph summary plus links to at least one screenshot and one short video (hosted off-repo; commit no media).
4. Update `tracking/seen-bookmarks.json`: move pick id `2100888166219886818` (slug `harness-router`) from `proposed` to `built`.
5. Vercel-ready (`.env.example`, `vercel.json`). Attribute HarnessRouter (https://github.com/HarnessRouter/harnessrouter, Apache-2.0), UHP, and the bookmark https://x.com/akshay_pachaar/status/2100888166219886818. Do **not** create the Vercel project or edit root README Live demos in this PR.
6. Do **not** create a new GitHub repository. Stay inside `apps/harness-router/` (plus the bookmark tracking update). Never touch sibling apps.
7. If any link in this PLAN fails, use the Background section above and do not search elsewhere.
