# Tech demos monorepo

Sticky repo of small single-user tech demos. Each pick becomes one self-contained app under `apps/<slug>/`.

## Layout

- `apps/<slug>/` — one demo app per pick; runs with `bun install && bun run dev`
- `tracking/seen-bookmarks.json` — picks already proposed or built
- `skills/project-planning/` — the planning skill; defines PLAN.md structure

## Build

A build runs unattended from a plan handed to the build agent (see `docs/CLOUD_BUILD.md` for the current builder and how it is triggered). Steps:

1. Save the given plan verbatim to `apps/<slug>/PLAN.md`. It is already planned; do not re-plan.
2. Build under `apps/<slug>/` only. Never touch another app; never create a new GitHub repo.
3. Bun for everything. Before the first install, write `bunfig.toml` with `[install] minimumReleaseAge = 259200`. Scaffold with `bunx create-*`; add shadcn/ui for UI.
4. Run the app. Capture proof: at least one screenshot and at least one short video, hosted off-repo. Commit no media.
5. Move the pick to `built` in `tracking/seen-bookmarks.json`.
6. Open one PR to `main` (branch `demo-<slug>`): link the screenshot and video, one-paragraph summary.
