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

Claude Code has an artifact host, but it is not a raw-file host: an artifact is a single self-contained HTML/Markdown page published to a stable claude.ai URL (shareable via public link on Pro/Max), with images embedded as data URIs inside a 16 MiB page and external media blocked by CSP. A cloud session/routine can publish one (they are claude.ai-authenticated). So:

- Screenshot / visual proof: capture via headless Chromium (`chromedriver` preinstalled; or Playwright), then either commit under `apps/<slug>/.demo/` (renders inline in the PR) OR publish an interactive "demo walkthrough" artifact (screenshots + annotations) and link its claude.ai URL in the PR. The artifact route is arguably richer than Cursor's flat image links.
- Video: not a natural fit for an artifact (no file serving, 16 MiB page cap). Capture with Playwright + ffmpeg and either commit under `apps/<slug>/.demo/` or `gh release upload` it and link it.

`gh` is preinstalled and reads `GH_TOKEN`, so the PR is opened over the API, no browser.

## Gotchas

- **Bun + proxy**: Anthropic-hosted cloud envs route all egress through a security proxy, and Bun has known package-fetch issues with it. This repo is Bun-based, so validate `bun install` on the first cloud run before trusting the daily cadence; fall back to a setup-script install or npm if it misbehaves.
- **Network allowlist**: the Default env's Trusted network allows Ubuntu apt + npm/pypi + nodejs.org. Installing chromium via apt is fine; if you use Playwright's own browser download it may need its CDN added to the env's allowed domains.
- **Preinstalled**: `gh`, `chromedriver`, Node 20/21/22, Python, Ruby, Postgres/Redis (not running). Add anything else via the setup script.
