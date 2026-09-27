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
- Every demo PR must attach at least one screenshot AND at least one video of the running app
- Cloudflare Pages (optional): one project for the whole repo, path per `apps/<slug>/` — not required for MVP

## Cloud builds

Builds run on Claude Code, not Cursor Cloud, billed to the owner's Claude Max subscription.

- Trigger: open an issue with the Demo build template (or any issue mentioning `@claude`). The `Claude demo build` workflow (`.github/workflows/claude-demo-build.yml`) runs `anthropics/claude-code-action` on Fable and opens the PR.
- Standing build contract for triggered runs lives in `CLAUDE.md`.
- Auth is the repo secret `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`), so runs bill to Max, not API credits.
