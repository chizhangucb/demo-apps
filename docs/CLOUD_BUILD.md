# Cloud build runbook

How Grok hands a demo build to Claude Code instead of Cursor Cloud. Builds run as a Claude Code cloud session (visible at claude.ai/code), on Fable, billed to the Max subscription. No browser automation.

Grok's job is unchanged: pick the weekday X bookmark, plan it per `skills/project-planning`. Only the build handoff changes: instead of Cursor's `createAgent` API, Grok fires a Claude Code cloud session over the API.

Two ways to fire it. Option A is the fit for this setup: Grok runs 100% in the cloud and fires the build with a single authenticated POST, exactly like its old Cursor `createAgent` call. Option B (`claude --cloud`) is a CLI that needs a persistent launcher machine with the CLI installed, logged in, and holding a repo checkout. An all-cloud Grok has no such machine, so B is documented only as a fallback for anyone who does.

## Option A (recommended): routine + API trigger

One saved routine, fired by an authenticated POST. Dashboard-visible, model pinned, no local checkout needed.

### One-time setup (owner)

1. Connect GitHub for cloud sessions: install the Claude GitHub App on `chizhangucb/demo-apps` (https://github.com/apps/claude), or run `/web-setup` in the CLI.
2. Create the routine at https://claude.ai/code/routines -> New routine:
   - Name: `Demo App Builder`
   - Repository: `chizhangucb/demo-apps`
   - Model: Fable (`claude-fable-5-1`)
   - Environment: one whose setup script installs Bun + Playwright + ffmpeg (see below)
   - Prompt: paste the routine prompt below
   - Trigger: add ONLY an API trigger (no schedule, no GitHub trigger), Generate token, copy the URL and token once
   - Connectors: remove all (a demo build needs none, and connectors get write access without asking)
   - Behavior: leave Auto-fix off (review demo PRs yourself)
   - Notifications: optional
3. Store the token in Grok's secret store (never in this repo).

This routine is not a scheduler or a second orchestrator. It is a saved build configuration with a callable endpoint: the "build worker" Grok hands a plan to, the same role Cursor's `createAgent` played. Grok stays the only scheduled brain (its 9am weekday run picks the bookmark, gets approval, writes PLAN.md), then fires this routine on demand. Because the routine has no schedule of its own, it never runs unless Grok calls it.

### Routine prompt (paste into the routine form)

```
You build one small single-user tech demo in the chizhangucb/demo-apps repo, then open one PR. The repo's AGENTS.md and skills/project-planning hold the build rules; follow them.

The bookmark pick and the plan for this run are in the <routine-fire-payload> block. Then:
1. Save the plan from the payload verbatim to apps/<slug>/PLAN.md. Do not re-plan; Grok already did. If no slug is given, derive one from the bookmark title.
2. Build the demo under apps/<slug>/ per AGENTS.md.
3. Proof: publish at least one screenshot as a Claude artifact (an HTML page embedding the image) and link the artifact URL in the PR; upload at least one short video as a GitHub release asset (gh release, tag demo-<slug>) and link it. Commit no media.
4. Move the pick into "built" in tracking/seen-bookmarks.json.
5. Open one PR from claude/demo-<slug> to main: link the screenshot artifact and the video, one-paragraph summary.
```

### Cloud environment

Create an environment (`Demo Env`) with:

- **Network access: Full.** Trusted's default allowlist blocks `bun.sh` and Playwright's browser CDN (so the setup script 403s) and blocks the unpredictable third-party APIs the demos call (so the app won't run for capture). Full is the pragmatic choice; Custom (default list + `bun.sh` + Playwright CDN + each demo's API) is tighter but per-demo maintenance.
- **Environment variables: none.** They are visible to anyone using the environment, so never put secrets here. A demo that needs a key to run gets it as an **API credential** (kept outside the sandbox), or runs in its keyless/sample mode.
- **Setup script:** below. It is cached between runs.

Then select `Demo Env` as the routine's environment.

```bash
set -euo pipefail
# Setup scripts run as root, so no sudo.
# Bun
curl -fsSL https://bun.sh/install | bash
ln -sf "$HOME/.bun/bin/bun" /usr/local/bin/bun
ln -sf "$HOME/.bun/bin/bunx" /usr/local/bin/bunx
# Capture deps (ffmpeg for video; Playwright brings its own chromium)
apt-get update && apt-get install -y ffmpeg
bunx --bun playwright install --with-deps chromium
```

### What Grok runs (replaces the Cursor call)

After planning, Grok POSTs the plan as the fire payload:

```bash
curl -sS -X POST "$CLAUDE_ROUTINE_FIRE_URL" \
  -H "Authorization: Bearer $CLAUDE_ROUTINE_TOKEN" \
  -H "anthropic-beta: experimental-cc-routine-2026-04-01" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg t "$PLAN_TEXT" '{text:$t}')"
```

Response gives `claude_code_session_url`; Grok reports that link and waits for the PR.

Note: routines are in research preview, so the endpoint/beta header may change. There is a per-account daily routine run cap.

## Option B (fallback): claude --cloud from a repo checkout

Only relevant if you have a persistent machine to launch from (not the case for an all-cloud Grok). `claude --cloud` is a CLI command: it runs on whatever machine invokes it, and that machine needs the `claude` CLI installed, signed into Max (`claude auth login`, one-time), and holding a `chizhangucb/demo-apps` checkout, because the command reads that directory's git remote + branch to tell the new cloud VM what to clone. The build itself still runs in Anthropic's cloud; the launcher is just the trigger. If you have such a machine:

```bash
cd /path/to/demo-apps && git pull
claude --cloud "Build the demo described below, following AGENTS.md and skills/project-planning. <PLAN_TEXT>" \
  --model claude-fable-5-1 \
  --output-format json
```

This creates a dashboard-visible cloud session and prints `{ok, session_id, url}`. The cloud VM clones the repo's remote at the current branch, so push any local commits first. Same build contract (AGENTS.md) applies; the session opens the PR.

## Why not GitHub Actions

`anthropics/claude-code-action` runs in a GitHub Actions runner, so its runs show up in the repo's Actions tab, not at claude.ai/code. Both cloud-session options above are dashboard-visible, which is the goal here.

## Media capture (vs Cursor)

What Cursor actually did: its VM shipped Chrome for computer-use, the agent captured a screenshot (.webp) + video (.mp4) into `/opt/cursor/artifacts/`, Cursor auto-uploaded them to its own artifact host, and the PR body linked those URLs (see PRs #1/#2: `cursor.com/agents/<id>/artifacts/...`). Nothing was committed to the repo and nothing used GitHub's attachment upload.

Mirror Cursor: never commit media, host it off-repo, and link the URLs in the PR. Split by media type:

- Screenshot: capture via headless Chromium (`chromedriver` preinstalled; or Playwright), publish it as a Claude artifact (a small HTML page embedding the image as a data URI, stable claude.ai URL), and link the artifact in the PR. This is the direct analog of Cursor's artifact links.
- Video: capture with Playwright + ffmpeg, upload as a GitHub release asset (`gh release`, tag `demo-<slug>`), and link it. Artifacts can't host video (no file serving, 16 MiB page cap), so the release asset carries it.

`gh` is preinstalled and reads `GH_TOKEN`, so the PR opens over the API, no browser.

Validate on the smoke test: publishing a NEW artifact goes through permission mode, and a routine runs without a permission picker, so confirm the screenshot artifact actually publishes unattended on the first run. If it stalls waiting for approval, fall back to hosting the screenshot as a release asset too.

## Gotchas

- **Bun + proxy**: Anthropic-hosted cloud envs route all egress through a security proxy, and Bun has known package-fetch issues with it. This repo is Bun-based, so validate `bun install` on the first cloud run before trusting the daily cadence; fall back to a setup-script install or npm if it misbehaves.
- **Network allowlist**: the Default env's Trusted network allows Ubuntu apt + npm/pypi + nodejs.org. Installing chromium via apt is fine; if you use Playwright's own browser download it may need its CDN added to the env's allowed domains.
- **Preinstalled**: `gh`, `chromedriver`, Node 20/21/22, Python, Ruby, Postgres/Redis (not running). Add anything else via the setup script.
