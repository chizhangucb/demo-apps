# codex-security-scan

## Goal
Single-user **Codex Security scan studio**: a sticky Bun/Next.js demo of [`@openai/codex-security`](https://www.npmjs.com/package/@openai/codex-security) that scans **both** (1) a canned vulnerable sample in-repo and (2) a real product checkout of [`chizhangucb/chronicle`](https://github.com/chizhangucb/chronicle), then shows **side-by-side findings** with an optional patch preview — inspired by OpenAI’s Codex Security CLI/SDK.

Source bookmark: https://x.com/OpenAI/status/2082263717916586117

## Single-user MVP
- One sticky App Router page: **dual-target** scan studio with two columns (or tabs) — **Canned sample** vs **Chronicle**
- **Canned vulnerable sample** under `apps/codex-security-scan/samples/` (small intentional vulns: e.g. hardcoded secret, SQLi-ish string concat, unsafe `eval`/command pattern) — enough for the SDK/mock runner to surface findings
- **Chronicle target**: public GitHub repo `https://github.com/chizhangucb/chronicle` — **clone-at-build** into a cache dir **or** fetch-on-demand at scan time (shallow clone / tarball). Do **not** bake secrets, tokens, or private credentials into the image or repo
- **Scripted / no-key path first**: canned findings fixtures for both targets so the live Vercel demo works with zero `OPENAI_API_KEY` / Codex auth (clear degraded banner when live keys absent)
- Side-by-side **findings** UI (severity, title, path/line, rationale); optional **patch preview** panel when a finding has a suggested fix
- Live path via serverless `/api` routes using `@openai/codex-security` (`CodexSecurity` / CLI) when `OPENAI_API_KEY` (or documented Codex auth) is present; keep keys server-side only
- `bun install && bun run dev` from `apps/codex-security-scan/` only
- Root `bunfig.toml` with `[install] minimumReleaseAge = 259200` before any install
- **Vercel-ready**: `.env.example`, `vercel.json` mirroring sibling apps; scripted mode works without keys
- **Builder fan-out OK**: parallel sub-agents for sample-target work vs chronicle-target work are encouraged
- **Finish line (post-merge ship, not this build PR):** live Vercel production URL + root README **Live demos** table row (`App | App directory | Public URL | Notes`)

## Explicitly out of scope
- Full deep-mode multi-hour Codex Security runs against large monorepos in the default demo path
- Creating GitHub PRs from the demo (`--create-pr`) or mutating the chronicle remote
- Multi-user auth, persistence beyond local session, or a findings database
- Vendoring the entire `openai/codex-security` repo — use the published npm package
- Training / fine-tuning models
- Creating a new GitHub repo (build only under this monorepo path)
- Creating the Vercel project or editing root README Live demos in this build PR (parent / human ships after merge)
- Baking any API keys, `.env`, or private chronicle credentials into the tree or build artifacts

## Outcome-oriented tasks
1. Scaffold **Next.js (App Router)** with Bun; initialize shadcn/ui (minimalist); write `bunfig.toml` with `minimumReleaseAge = 259200` **before** any install
2. Add `samples/` canned vulnerable mini-project + `data/` scripted findings fixtures for sample **and** chronicle (so no-key demo is complete)
3. Chronicle acquisition: document + implement shallow clone or GitHub archive fetch of `chizhangucb/chronicle` (public, no secrets); cache under a gitignored path; fail gracefully if fetch blocked on Vercel cold start (fall back to scripted chronicle fixtures)
4. Studio UI: dual-target controls → run scan(s) → **side-by-side findings** + optional **patch preview**; degraded banner when live keys absent
5. Wire scripted runner end-to-end (no API key); optional live `/api/scan` (and patch preview route) using `@openai/codex-security` only when env present
6. README: how to run, env vars (`OPENAI_API_KEY` / Codex auth), attribution to https://github.com/openai/codex-security and https://developers.openai.com/codex/security, bookmark link, chronicle source link, note scripted vs live
7. Validation: at least one screenshot and one short video of the running app (hosted off-repo); link both in the PR; commit no media
8. Move this pick from `proposed` → `built` in `tracking/seen-bookmarks.json` (keep slug `codex-security-scan`, id `2082263717916586117`)
9. After merge: Vercel project (root dir `apps/codex-security-scan/`) + README Live demos table row — not part of this build PR; finish line = production URL in that table

## Stack
- Bun — runtime / package manager / scripts (monorepo default per AGENTS.md)
- Next.js (App Router) — sticky demo + easy serverless `/api` for optional live Codex Security
- shadcn/ui + Tailwind — minimal UI primitives (match sibling demos)
- `@openai/codex-security` — official TypeScript SDK/CLI for scan + patch
- Vercel — shareable host (`vercel.json`; serverless `/api` for live path; scripted path for zero-secret demos)
- `chizhangucb/chronicle` — real product repo target (public clone/fetch only)

## Env (document in `.env.example` + README)
- `OPENAI_API_KEY` — optional; enables live `@openai/codex-security` scans via `/api` (server-side only). Without it, scripted fixtures power the demo.
- Any additional Codex Security auth vars the package documents (e.g. ChatGPT auth for local CLI) — note them; prefer API key for Vercel serverless.
- Do **not** require secrets for the default Vercel production demo path.

## Reference
- Codex Security: https://github.com/openai/codex-security · https://developers.openai.com/codex/security · npm `@openai/codex-security`
- Bookmark: https://x.com/OpenAI/status/2082263717916586117
- Chronicle (scan target): https://github.com/chizhangucb/chronicle
- Monorepo build contract: root `AGENTS.md`

## Deferred
- Deep-mode / multi-worker long scans as the default demo path
- Uploading arbitrary user repos from the browser
- Creating fix PRs against remote remotes
- Cloudflare deploy path
- Saving scan history across sessions

---

## Build instruction (Claude Code routine)

Build this demo end-to-end under `apps/codex-security-scan/` in the existing GitHub repo **chizhangucb/demo-apps** (do NOT create a new repo). Follow root `AGENTS.md` and this PLAN.md verbatim.

**Angle (must ship):** Bun/Next demo that scans **both** (1) a canned vulnerable sample in-repo and (2) a real product repo checkout of https://github.com/chizhangucb/chronicle. Side-by-side findings + optional patch preview via Vercel API route using `@openai/codex-security`. Parallel sub-agent fan-out for sample vs chronicle is OK. Finish line after merge = live Vercel production URL in root README Live demos table (do **not** invent URLs or edit that table in this build PR).

Required outcomes:
1. Implement the MVP in `apps/codex-security-scan/` only (Bun + Next.js App Router + shadcn; `bunfig.toml` with `minimumReleaseAge = 259200` before install; `bun install && bun run dev`).
2. Dual targets + scripted/no-key path first so the live demo works without secrets; optional live SDK behind env via serverless `/api`; clear degraded banner without keys. Chronicle via public clone-at-build or fetch-on-demand — no baked secrets.
3. Open one PR to `main` on branch `demo-codex-security-scan` with a one-paragraph summary plus links to at least one screenshot and one short video (hosted off-repo; commit no media).
4. Update `tracking/seen-bookmarks.json`: move pick id `2082263717916586117` (slug `codex-security-scan`) from `proposed` to `built`.
5. Vercel-ready (`.env.example`, `vercel.json`). Attribute Codex Security + bookmark + chronicle. Do **not** create the Vercel project or edit root README Live demos in this PR (post-merge ship: Root Directory `apps/codex-security-scan/`; finish line = production URL in Live demos).
6. Do **not** create a new GitHub repository. Stay inside `apps/codex-security-scan/` (plus the bookmark tracking update). Never touch sibling apps.