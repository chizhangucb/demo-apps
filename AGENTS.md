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
- Cloud agent builds use model `claude-fable-5` (Fable 5) unless the owner asks otherwise
- Every demo PR must attach at least one screenshot AND at least one video of the running app
- Cloudflare Pages (optional): one project for the whole repo, path per `apps/<slug>/` — not required for MVP
