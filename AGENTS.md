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

Builds run on Claude Code, not Cursor Cloud, billed to the owner's Claude Max subscription.

- Trigger: open an issue mentioning `@claude` with the plan in the body (the Demo build template is the envelope; a human can also open one from the GitHub UI). The `Claude demo build` workflow (`.github/workflows/claude-demo-build.yml`) runs `anthropics/claude-code-action` on Fable and opens the PR.
- Auth is the repo secret `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`), so runs bill to Max, not API credits.

### Contract for a triggered build

The triggering issue is the spec. Grok picks the X bookmark and writes the plan per `skills/project-planning/SKILL.md`; that plan is the issue body. On trigger, do the whole build unattended:

1. Write the plan to `apps/<slug>/PLAN.md` first (same structure the planning skill defines).
2. Build under `apps/<slug>/` only. Never create a new repo, never touch other apps. Bun for everything; `bunfig.toml` with `[install] minimumReleaseAge = 259200` before the first install. Prefer official scaffolds (`bunx create-*`), then shadcn/ui for UI.
3. Run the app, then capture proof: at least one screenshot AND one short video (Playwright + ffmpeg are installed in the runner).
4. Update tracking: move the pick into `built` in `tracking/seen-bookmarks.json`.
5. Open a PR from branch `claude/demo-<slug>` to `main`, with the screenshot and video in the PR, plus a one-paragraph summary.
