# Yobiru Agent Mesh

A single-user playground for [Yobiru](https://github.com/chekusu/yobiru), the open-source layer that lets personal agents on different machines message each other over your own Tailscale network. Three simulated machines pass a bug bundle, a repro task and a result back along the reply path, using the tailmsg v1 envelope, the receiver auth order, allow and deny policy, wake levels with downgrades, and a file transfer with a real SHA-256 check you can tamper with.

**Simulated network.** Tailscale does not run on Vercel. No real machines, sockets, Python CLI or Docker are involved. The tailnet, `tailscale whois`, the receivers and the CLI are simulated; the envelope validation, auth pipeline, policy, wake computation, request lifecycle, reply routing and SHA-256 hashing are real code running in your browser. Runs in **Scripted mode** with zero secrets.

## Run

```bash
bun install
bun run dev      # http://localhost:3000
bun test         # mesh library + preset tests
bun run lint && bun run typecheck
```

## The story

| Machine | IP | Agent | Default policy |
| --- | --- | --- | --- |
| `cloud` | 100.101.7.12 | `grokbot` | tailnet, wake `home-mac=now` |
| `home-mac` | 100.88.21.4 | `codex` | tailnet, wake `cloud=now, tokyo-server=now` |
| `tokyo-server` | 100.120.45.9 | `claude` | allowlist `[home-mac]`, wake `home-mac=now` |

1. `grokbot@cloud` runs `yobiru request send home-mac/codex ... --wake now --file ./bugs.json`. The file is copied to an outbox token dir and served only to `home-mac` for 24h.
2. `home-mac` checks tailnet range, whois, envelope, policy and `from`, returns 202, computes wake (now), wakes codex. codex fetches `bugs.json`, writes `.part`, checks size and SHA-256, renames on match.
3. codex sends `running`, then a repro request for BUG-101 to `tokyo-server/claude` with `from_agent: codex`.
4. claude replies `completed` with `repro.json`, routed back by `reply_to` and `from_agent` to the whois peer (not the envelope `from`).
5. codex sends the `completed` summary to `grokbot@cloud`. The reply path tokyo-server, home-mac, cloud is highlighted.

## Failure presets

| Preset | What changes | Result |
| --- | --- | --- |
| Deny rule | `home-mac` deny `cloud` | 403 policy denied (deny always wins), request failed |
| Allowlist miss | `tokyo-server` allow `[tag:ci]` | repro request 403, request blocked |
| Spoofed from | envelope `from` says tokyo-server, whois says cloud | 403 from does not match whois |
| Quiet hours | `tokyo-server` quiet_hours `22:00-07:00` (it is 23:00 in Tokyo) | wake `now` to `batch` with reason `quiet hours`, claude stays asleep, repro times out |
| Tamper | bytes of the served `bugs.json` flipped after send | SHA-256 mismatch, `.part` deleted, request failed |

Every machine card has an **Edit policy** panel (mode, allow, deny, wake_policy, default_max, quiet_hours, wake_rate, per-agent wake_max). Change a setting and press Run to replay with it. The Tamper and Spoof switches work on any policy.

## Code map

- `src/lib/mesh/`: the simulated mesh. `envelope.ts` (unknown fields 400, 256 KiB cap), `receiver.ts` (auth order: 415, 413, tailnet range, whois, envelope, policy, from check, duplicate 200, store 202), `policy.ts` (hostname, FQDN, `tag:`, `user:` rules; deny wins), `wake.ts` (cap, quiet hours, rate limit, per-agent max, unknown agent), `files.ts` (outbox grants, recipient check, expiry, `.part` and SHA-256 verify), `requests.ts` (lifecycle and timeouts), `mesh.ts` (machines, whois, reply routing, local-only ack).
- `src/lib/story.ts`: runs the scripted story on a fresh mesh and returns typed events; `src/lib/view.ts` folds them into UI state for step and play.
- `data/`: `bugs.json`, `repro.json` and the scripted reply texts.
- `tests/mesh.test.ts`: unit tests for each rule plus every preset.

## Optional live replies

If `ANTHROPIC_API_KEY` is set (same env names as `apps/claude-agent-loops`, server-side only, see `.env.example`), a "Live replies" toggle appears and three reply texts (codex progress, claude repro reply, codex summary) are written by Claude via `POST /api/live`: at most 3 calls per run, small output budget, scripted text on any error. Envelopes, files and hashes stay scripted.

## Not included

Real Tailscale, sockets, the Python CLI, Docker, `/info` discovery UI, multi-file bundles, upgrade notices, persistence beyond the page.

## Deploy

Vercel, Root Directory `apps/yobiru-agent-mesh/`, no environment variables needed. `vercel.json` uses Bun for install and build.

## Credits

- Yobiru by [@turingou](https://x.com/turingou): [github.com/chekusu/yobiru](https://github.com/chekusu/yobiru), [yobiru.com](https://yobiru.com)
- Bookmark: [x.com/turingou/status/2109643779464720568](https://x.com/turingou/status/2109643779464720568)
- Unofficial demo, not affiliated with Yobiru.
