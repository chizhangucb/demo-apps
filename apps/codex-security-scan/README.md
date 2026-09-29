# Codex Security Scan Studio

A single-page Bun + Next.js demo of OpenAI's [Codex Security](https://github.com/openai/codex-security)
SDK ([`@openai/codex-security`](https://www.npmjs.com/package/@openai/codex-security), docs at
[developers.openai.com/codex/security](https://developers.openai.com/codex/security)). It scans two
targets side by side:

1. **Canned sample** — [`samples/vuln-notes`](samples/vuln-notes), a tiny notes API with planted bugs
   (command injection, `eval`, SQL injection, path traversal, a hardcoded key, MD5 passwords, open redirect).
2. **Chronicle** — the real product repo [chizhangucb/chronicle](https://github.com/chizhangucb/chronicle),
   fetched on demand as a public GitHub archive (no token) and unpacked into a tmp cache.

Click **Scan both targets** to run both lanes in parallel, compare the severity grid, then click any
finding for a **patch preview** (unified diff + remediation). Previews are never applied or pushed.

Inspired by [@OpenAI's Codex Security launch](https://x.com/OpenAI/status/2082263717916586117).

## Run

```bash
bun install
bun run dev   # http://localhost:3000
```

## Modes

| Mode | Needs | What happens |
| --- | --- | --- |
| **Scripted** (default) | nothing | Canned findings from `data/*.json`. Each snippet is re-checked against the bundled sample / the freshly fetched chronicle checkout and marked "snippet matches checkout". If GitHub can't be reached, chronicle falls back to findings pinned to commit `09371bf`. |
| **SDK mock** | Python 3.10+, git | Runs the real `CodexSecurity.run(repo, { mock: true })` pipeline on a git snapshot of each target. No key, no model calls; the SDK returns 12 synthetic `[Mock]` findings. |
| **Live** | `OPENAI_API_KEY` (or `CODEX_API_KEY`), Python, git | Real Codex Security standard scan (`auth: "api-key"`, `maxCostUsd` cap; chronicle is limited to `server/`). Patch preview additionally calls `security.validate()` for a live disposition + report. |

The page shows a degraded-mode banner whenever no key is configured, and disables modes the host can't run.
Any SDK failure falls back to scripted findings with a warning in that lane.

The chronicle fixtures came from a manual static review of commit `09371bf` and are demo data,
not a full audit.

## API

- `POST /api/scan` `{ target: "sample" | "chronicle", mode: "scripted" | "sdk-mock" | "live" }` → findings, checkout info, warnings
- `POST /api/patch` `{ target, mode, finding }` → patch diff, remediation, and (live) validation disposition/report

## Deploy (Vercel)

Root Directory `apps/codex-security-scan/`; `vercel.json` sets `bun install` / `bun run build`.
No env vars are required: scripted mode (with live chronicle fetch) works there as is. Vercel functions
have no Python/git and the Codex native binary (~370 MB) is excluded from tracing on Vercel, so SDK mock
and Live are local/container features. See `.env.example` for all variables.
