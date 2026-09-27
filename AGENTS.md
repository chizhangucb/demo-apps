# Tech demos monorepo

One sticky repo for small single-user tech demos.

## Layout

- `apps/<slug>/` — one self-contained demo app per pick (`bun install && bun run dev`)
- `tracking/seen-bookmarks.json` — bookmarks already proposed or built
- `skills/project-planning/` — vendored planning skill used before a cloud agent build

## Rules

- Never create a new GitHub repository per demo; always add under `apps/<slug>/`
- Bun as runtime, package manager, and script runner
- Every Bun app root must include `bunfig.toml` with `[install] minimumReleaseAge = 259200` before install
- Prefer official scaffolds via `bunx create-*`, then shadcn/ui when there is UI
- Cloud agent builds use model `claude-fable-5-1` (Fable 5.1) unless the owner asks otherwise
- Every demo PR must include at least one screenshot AND at least one video of the running app
- Vercel (hosting): deploy each demo as its own Vercel project with Root Directory `apps/<slug>/`; add the public URL to the Live demos table in `README.md` once live. Not required for the MVP PR.

## Cloud builds

Builds run as a **Claude Code cloud session** (visible at claude.ai/code), on Fable (`claude-fable-5-1`), billed to the owner's Claude Max subscription. Not Cursor Cloud.

- Grok picks the X bookmark and writes the plan per `skills/project-planning/SKILL.md`, then fires the build over the API (no browser): either a routine API trigger (`POST .../fire`) or `claude --cloud`. The plan arrives as the session's task.
- The cloud environment installs Bun + Playwright + ffmpeg via its setup script, so the session can scaffold, run, and capture the demo.
- See the owner's runbook (`docs/CLOUD_BUILD.md`) for the trigger wiring and one-time setup.

### Contract for a build

Do the whole build unattended from the plan you are given:

1. Write the plan to `apps/<slug>/PLAN.md` first (same structure `skills/project-planning` defines).
2. Build under `apps/<slug>/` only. Never create a new repo, never touch other apps. Bun for everything; `bunfig.toml` with `[install] minimumReleaseAge = 259200` before the first install. Prefer official scaffolds (`bunx create-*`), then shadcn/ui for UI.
3. Run the app, then capture proof: at least one screenshot AND one short video, committed under `apps/<slug>/.demo/`.
4. Update tracking: move the pick into `built` in `tracking/seen-bookmarks.json`.
5. Open a PR from branch `claude/demo-<slug>` to `main`, embedding the screenshot and linking the video, plus a one-paragraph summary.
