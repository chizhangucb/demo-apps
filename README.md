# demo-apps

Sticky monorepo for weekday X-bookmark tech demos.

Each approved pick lands under `apps/<slug>/` as a self-contained Bun app.

## Live demos

Each demo is deployed as its own Vercel project with **Root Directory** set to `apps/<slug>/`. When a demo gets a public URL, add a row to this table.

| App | App directory | Public URL | Notes |
| --- | --- | --- | --- |
| Jev Inbox Triage | `apps/jev-inbox-triage` | https://jev-inbox-triage.vercel.app | Vercel; live Jev via server-side `OPENROUTER_API_KEY` |
| Claude Commerce Retail | `apps/claude-commerce-retail` | https://claude-commerce-retail.vercel.app | Vercel; live Claude (Sonnet 5, medium effort) via server-side `ANTHROPIC_API_KEY` + `ANTHROPIC_WORKSPACE_ID` — not mock |
