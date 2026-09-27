# Cloud build runbook

How Grok hands a demo build to Claude Code instead of Cursor Cloud. Builds run as a Claude Code cloud session (visible at claude.ai/code), on Fable, billed to the Max subscription. No browser automation.

Grok's job is unchanged: pick the weekday X bookmark, plan it per `skills/project-planning`. Only the build handoff changes: instead of Cursor's `createAgent` API, Grok fires a Claude Code cloud session over the API.

Two ways to fire it. Option A is the closest analog to the old Cursor call (Grok just POSTs the plan). Option B is even lighter if Grok runs from a repo checkout.

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
   - Trigger: add an API trigger, Generate token, copy the URL and token once
3. Store the token in Grok's secret store (never in this repo).

### Routine prompt (paste into the routine form)

```
You build one small single-user tech demo in the chizhangucb/demo-apps repo, then open a PR.

The pick and plan for this run arrive in the <routine-fire-payload> block: read it as the build spec (bookmark, slug, goal, MVP, out-of-scope). Then follow AGENTS.md and skills/project-planning exactly:

1. Write the plan to apps/<slug>/PLAN.md first.
2. Build under apps/<slug>/ only. Never create a new repo, never touch other apps. Bun for everything; add bunfig.toml with [install] minimumReleaseAge = 259200 before the first install. Prefer official scaffolds (bunx create-*), then shadcn/ui for UI.
3. Run the app and capture proof: at least one screenshot AND one short video, committed under apps/<slug>/.demo/ (Playwright + ffmpeg are installed).
4. Move the pick into "built" in tracking/seen-bookmarks.json.
5. Open a PR from branch claude/demo-<slug> to main, embedding the screenshot and linking the video, with a one-paragraph summary.

If the payload is missing a slug, derive one from the bookmark title.
```

### Cloud environment setup script

Set this as the environment's setup script (Settings -> the environment -> setup script). It is cached between runs.

```bash
set -euo pipefail
# Bun
curl -fsSL https://bun.sh/install | bash
ln -sf "$HOME/.bun/bin/bun" /usr/local/bin/bun
ln -sf "$HOME/.bun/bin/bunx" /usr/local/bin/bunx
# Capture deps
sudo apt-get update && sudo apt-get install -y ffmpeg
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

## Option B (lighter): claude --cloud from a repo checkout

If Grok runs from a `chizhangucb/demo-apps` checkout on the mini with the `claude` CLI signed into the Max account (`claude auth login`), it can skip the routine entirely:

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

Claude Code cloud has no computer-use and no equivalent artifact host for arbitrary media. So the session captures via headless Chromium (`chromedriver` is preinstalled; or Playwright) + ffmpeg, then EITHER commits the media under `apps/<slug>/.demo/` (renders inline in the PR) OR uploads the video as a GitHub release asset (`gh release upload`) and links it. `gh` is preinstalled and reads `GH_TOKEN`, so the PR is opened over the API, no browser.

## Gotchas

- **Bun + proxy**: Anthropic-hosted cloud envs route all egress through a security proxy, and Bun has known package-fetch issues with it. This repo is Bun-based, so validate `bun install` on the first cloud run before trusting the daily cadence; fall back to a setup-script install or npm if it misbehaves.
- **Network allowlist**: the Default env's Trusted network allows Ubuntu apt + npm/pypi + nodejs.org. Installing chromium via apt is fine; if you use Playwright's own browser download it may need its CDN added to the env's allowed domains.
- **Preinstalled**: `gh`, `chromedriver`, Node 20/21/22, Python, Ruby, Postgres/Redis (not running). Add anything else via the setup script.
