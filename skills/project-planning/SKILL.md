---
name: project-planning
description: Use when starting a new demo app under apps/<slug>/, scoping an MVP, or writing PLAN.md before a cloud agent build.
---

# Project planning

Turn a demo idea into a focused, MVP-first plan. Favor prebuilt solutions and opinionated frameworks.

## Workflow

1. Clarify the goal in one sentence and define the single-user MVP boundary.
2. Decompose into outcome-oriented tasks (vertical slices).
3. Prefer official scaffolds via `bunx create-*` (Next, Vite, T3, TanStack, Expo).
4. Before any dependency install, ensure `bunfig.toml` has `[install] minimumReleaseAge = 259200`.
5. For UI, initialize shadcn/ui with a minimalist preset; add components on demand.
6. Write `apps/<slug>/PLAN.md` with: goal, MVP + outs, task list, stack with one-line rationale, deferred items.

## Rules

- Build for one user first
- Bun by default
- Prefer prebuilt over bespoke
- Cut features before cutting clarity
- Defer anything not on the path to a working MVP
