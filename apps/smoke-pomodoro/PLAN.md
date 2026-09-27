Bookmark: (smoke test, no bookmark)
Slug: smoke-pomodoro

Goal: A single-user Pomodoro timer demo, fully client-side, no external APIs or keys.

Single-user MVP:
- One page: a 25:00 countdown with Start / Pause / Reset
- Toggle between Work (25m) and Break (5m)
- Clear running/paused visual state; document title shows time remaining
- Runs with: bun install && bun run dev from apps/smoke-pomodoro/

Out of scope:
- Persistence, notifications, sound, settings, auth, any backend or external API

Stack:
- Bun, Vite + React, Tailwind + shadcn/ui (Button)
