# Yobiru Agent Mesh: PLAN

## Goal

A single-user Next.js + Bun playground on Vercel that shows how Yobiru lets agents on different machines message each other over your own Tailscale network. Three simulated machines pass a bug bundle, a repro task, and a result back along the reply path, with per-machine allow and wake policy and a SHA-256 checked file transfer you can tamper with. The network is simulated and labelled as such (Tailscale cannot run on Vercel).

Source: bookmark https://x.com/turingou/status/2109643779464720568 (@turingou), site https://yobiru.com, repo https://github.com/chekusu/yobiru (README, SPEC.md, docs/).

If any link above fails to load, use the Background summary below and do not search elsewhere.

## Background (embedded summary of the Yobiru README and SPEC)

What it is: an open-source communication layer for personal agents across your computers and cloud workspaces, carried by Tailscale. Not a chat app, not a scheduler, no central server, no Yobiru account, no MCP server. It ships a plugin (six skills: yobiru-setup, yobiru-sessions, yobiru-send, yobiru-inbox, yobiru-wake, yobiru-upgrade) plus a stdlib Python CLI. Storage stays on your machines.

Addressing: `host/agent`, for example `research-node/grok`. One machine can host several agents; only the named agent is woken. The sender resolves the short hostname via `tailscale status --json` on each send.

Protocol (tailmsg v1):
- Each machine runs a receiver bound to its own Tailscale IP, default port `tcp:7766`.
- One send endpoint: `POST /msg` with a JSON envelope, 256 KiB cap. Status codes: 202 accepted into inbox (delivered, not processed), 200 duplicate id (idempotent), 400 bad format or unknown field or bad wake value or fetch URL not on sender host, 403 not a tailnet address or policy denied or `from` does not match Tailscale identity, 413 too large, 415 not JSON. Also `GET /health` and `GET /info` (discovery, advertises e.g. `request-lifecycle-v1`).
- Envelope fields: `v` (1), `id`, `from`, `to`, `ts`, `kind` (text, notice, request, status...), `text`, `reply_to`, `wake` (`now` | `batch` | `none`, default batch), `agent` (target agent on receiver), `from_agent` (so replies route back to the asker), `fetch` (file list), `request` / `response` (lifecycle metadata). Unknown fields are rejected with 400.
- Example envelope:
  ```json
  {"v":1,"id":"9f2c4e1ab07d33c5","from":"bot-box.example.ts.net","to":"dev-server.example.ts.net",
   "ts":"2026-10-08T14:00:00Z","kind":"request","text":"Please review.","wake":"now",
   "agent":"codex","from_agent":"grok",
   "fetch":[{"name":"bugs.json","url":"http://bot-box.example.ts.net:7766/f/<token>/bugs.json",
             "sha256":"<64 hex>","size":1834,"mime":"application/json","expires":"2026-10-09T14:00:00Z"}]}
  ```
- Receiver auth order: source IP must be in 100.64.0.0/10 or fd7a:115c:a1e0::/48; identify the peer with `tailscale whois`; apply local policy (`deny` always wins; `tailnet` mode admits any authenticated peer, `allowlist` mode requires an `allow` match; rules can be hostname, FQDN, `tag:NAME`, `user:LOGIN`); envelope `from` must equal the whois identity (anti spoofing). Accepted messages are stored in the local inbox; the whois peer is the trusted identity.
- Messages are never executed and are never approvals. JSON is content, not instructions. Message access does not grant wake, task execution or automatic replies.
- Files: the sender copies the file into an outbox token dir and serves `GET /f/<token>/<name>` only on its Tailscale IP, only to the `to` machine, expiring after 24h. The `url` host must be the sender itself. The recipient fetches when it chooses, writes `.part`, checks size and SHA-256, and only renames on match; on mismatch it deletes and reports an error.
- Wake: the sender requests a level; the receiver computes the effective level and only ever downgrades: min(requested, per-sender cap from `wake_policy`, default_max batch), then quiet hours turn now into batch, then a rate limit (`wake_rate`, default 6 per hour per sender and agent) turns extra now into batch. A per-agent `wake_max` caps further; naming a missing agent downgrades to batch. The result is recorded as `{"requested":"now","effective":"batch","reason":"quiet hours"}`. Only effective `now` calls the wake adapter.
- Requests (0.5): `request send` creates a tracked request with a receipt, progress (`running`), a final state (`completed`, `failed`, `rejected`, `blocked`), a deadline and timeout state. The receiver responds with `request respond ID TEXT --state ...` (optionally `--file`), addressed back to the original authenticated sender, then `ack` (local bookkeeping only, never notifies the sender).
- CLI shape for the UI's log pane: `yobiru send host/agent "text" --kind notice`, `yobiru request send host/agent '{json}' --timeout-seconds 900 --wake now --file ./x`, `yobiru inbox --pending --agent NAME`, `yobiru show ID`, `yobiru fetch ID`, `yobiru request respond ID "..." --state running|completed`, `yobiru ack ID`.

## Single-user MVP

Three simulated machines, each a card with its hostname, Tailscale style 100.x address, agents, receiver status, inbox, outbox, and local policy:
- `cloud` with agent `grokbot`
- `home-mac` with agent `codex`
- `tokyo-server` with agent `claude`

Main scripted story (one "Run" button, step or play, speed control):
1. `grokbot@cloud` sends a tracked request to `home-mac/codex` with `bugs.json` (three bug reports) attached via `fetch`. Envelope shown in full.
2. `home-mac` receiver: auth steps (tailnet range, whois, policy, from check) light up, 202, wake computed (requested now, effective now), wake adapter fires, codex fetches the file: size and SHA-256 verified, file lands in inbox.
3. `codex` sends `running`, then a repro request to `tokyo-server/claude` with one bug extracted, `from_agent: codex`.
4. `claude` replies with a repro result (steps, failing test, patch hint), file attached, routed back to `home-mac/codex` by `reply_to` and `from_agent`.
5. `codex` sends the final `completed` response with a summary JSON back to `cloud/grokbot`. The reply path is drawn as a highlighted route on the network diagram.

Policy panel per machine (editable): mode `tailnet` or `allowlist`, `allow` and `deny` lists, `wake_policy` caps per sender, `default_max`, `quiet_hours`, `wake_rate`, per-agent `wake_max`. Changing a setting and replaying shows the effect:
- A deny rule or allowlist miss returns 403 and the message is visibly refused (red bounce animation, receiver log line).
- Quiet hours or a cap shows requested vs effective wake and the reason, and the agent stays asleep (message waits in inbox as batch).
- A spoof button sends an envelope whose `from` does not match the whois identity, returning 403.

File transfer panel: shows the outbox token URL, expiry, expected size and SHA-256, a fetch progress bar, and the computed hash (real SHA-256 via Web Crypto or node crypto over the real bytes). A Tamper toggle flips bytes on the sender side after the envelope was sent; fetch then fails the check, the `.part` file is deleted, and the request moves to `failed` with a clear error.

Request lifecycle timeline per request: sent, 202 receipt, running, completed or failed or rejected, deadline countdown, timeout state.

Header badge: "Simulated network. Tailscale does not run on Vercel. No real machines are contacted." Scripted mode badge when no key.

Optional live mode: only if `ANTHROPIC_API_KEY` is set (same env name as `apps/claude-agent-loops`, server-side only), the three agents' reply texts are generated live with strict caps (max 3 calls per run, small max tokens), falling back to scripted on any error. Add no new secret names. The Vercel demo must work with zero secrets.

## Explicitly out of scope

Real Tailscale, real sockets, real Python CLI, Docker, any outbound network from the demo besides optional Anthropic calls, multi-user state, persistence beyond the browser session, group chat rooms, schedulers.

## Tasks (outcome oriented)

1. Scaffold `apps/yobiru-agent-mesh/` with Bun, Next.js App Router, TypeScript, Tailwind, shadcn. `bunfig.toml` with `minimumReleaseAge = 259200` before install.
2. A pure TypeScript simulated mesh in `src/lib/mesh/`: envelope validation (unknown fields 400, 256 KiB cap 413), receiver auth pipeline, policy evaluation (deny wins, tailnet vs allowlist), wake computation (cap, quiet hours, rate limit, per-agent max, missing agent), outbox file grants with expiry and recipient check, fetch with size + SHA-256 verify, request lifecycle states, reply routing via `reply_to` and `from_agent`. Unit tests for each rule.
3. Scripted scenario data in `data/` (the three bug reports, the repro result, the summary) and an event stream (SSE from `POST /api/run` or client driven, your choice) that animates the story.
4. UI: network diagram with moving message packets, three machine cards, envelope inspector, policy editors, file transfer panel with Tamper, lifecycle timeline, CLI style log per machine using the real command shapes.
5. Failure demos: deny, allowlist miss, spoofed `from`, quiet hours, tamper. Each with a one-click preset.
6. Optional live replies as described above.
7. README with run instructions, what is simulated, attribution, and `.env.example` (commit it; add a `!.env.example` negation if `.gitignore` ignores `.env*`). `vercel.json` if needed.

## Stack

Bun, Next.js App Router, TypeScript, Tailwind, shadcn/ui. Runs with `bun install && bun run dev`. Root Directory on Vercel will be `apps/yobiru-agent-mesh`.

## Env

- `ANTHROPIC_API_KEY` (optional, server-side only, same name as `apps/claude-agent-loops`). Also optionally `ANTHROPIC_MODEL`. No new secret names.

## References

- https://x.com/turingou/status/2109643779464720568
- https://yobiru.com
- https://github.com/chekusu/yobiru (README.md, SPEC.md, docs/SETUP.md, docs/PLATFORMS.md)

## Deferred

Real tailnet mode for local use, multi-file bundles beyond one per hop, discovery (`/info`, `agents --peer`) UI, upgrade notices.

## Build instructions for the Claude Code routine

Build only inside `apps/yobiru-agent-mesh/` plus moving tracking id `2109643779464720568` (slug `yobiru-agent-mesh`) from `proposed` to `built` in `tracking/seen-bookmarks.json`. Branch `demo-yobiru-agent-mesh`, one PR to `main`. Scripted no-key path first. Clearly label the network as simulated. Attribute Yobiru (@turingou, chekusu/yobiru, yobiru.com) and the bookmark. Do not create the Vercel project, do not edit the root README Live demos table, do not create a new repo, do not touch sibling apps. Host screenshots and a short video off-repo as a Claude artifact and link them in the PR; commit no media. No em dashes or en dashes in README, PR body, commit messages, or UI copy. If a link fails, use the Background summary above.
