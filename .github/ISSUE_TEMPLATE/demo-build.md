---
name: Demo build
about: Kick off a cloud demo build (triggers @claude on the Max subscription)
title: "[demo] <slug>"
labels: demo-build
---

@claude build this demo.

**Pick**
- Bookmark URL:
- Bookmark title:
- Slug (`apps/<slug>/`):

**Plan**
Paste the plan produced via `skills/project-planning` (goal, single-user MVP, out of scope, stack). That skill defines the structure; this issue is just the envelope that carries it and fires the build.

---
Build contract lives in `AGENTS.md` (build under `apps/<slug>/` only, capture a screenshot + video, update tracking, open a PR from `claude/demo-<slug>`).
