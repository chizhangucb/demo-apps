# CLAUDE.md

Standing rules for cloud demo builds triggered by an `@claude` issue. Read `AGENTS.md` first for repo layout and hard rules.

## When triggered by an issue

The triggering issue is the build spec (Grok writes it after picking an X bookmark and planning). Do the whole build unattended:

1. Read the issue body. It names the pick, the slug, and the MVP scope.
2. Follow `skills/project-planning/SKILL.md`. Write `apps/<slug>/PLAN.md` before installing anything.
3. Build the demo under `apps/<slug>/` only. Never create a new repo, never touch other apps.
4. Bun for everything. Every app root gets `bunfig.toml` with `[install] minimumReleaseAge = 259200` before the first install. Prefer official scaffolds (`bunx create-*`), then shadcn/ui for UI.
5. Run the app, then capture proof: at least one screenshot AND one short video of it running (Playwright + ffmpeg are installed in the runner). Commit them under `apps/<slug>/.demo/`.
6. Update tracking: move the pick into `built` in `tracking/seen-bookmarks.json`, and add a row to the Live demos table in `README.md` (URL blank until deployed).
7. Open a PR from branch `claude/demo-<slug>` to `main`. The PR body must embed the screenshot and link the video, plus a one-paragraph summary of what the demo shows.

## Model

Builds run on Fable (`claude-fable-5-1`), pinned in the workflow. Do not switch models unless the issue asks.

## Out of scope unless asked

Multi-user auth, persistence beyond local session, deploy config, and anything off the path to a working single-user MVP.
