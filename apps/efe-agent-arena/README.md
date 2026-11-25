# EFE Agent Arena

An interactive scoreboard of the published [Embodied First Exam](https://www.embodied-first-exam.ai/) (EFE) core results. Pick any two of the 11 officially ranked agents and a setting (Standard, Privileged, Realtime, or Overall). The page lists the core tests each agent solved that the other failed, grouped by suite, shows the leader or tied leaders in each of the 32 core suites, and shows the published RoboDojo prompt table.

**This is a scoreboard of published EFE results. It does not run Harbor, a simulator, or a coding agent.** It makes no model calls, scrapes nothing live, and needs no API keys.

## What it shows

- **Head to head.** First load is GPT-6.2 Astra vs Claude Fable 5.2 in Standard: only Astra 96, only Fable 65, both 183, neither 137 of 481 tests. Privileged gives 63 / 5 / 332 / 16 of 416. Every pair is recomputed in the browser from the official per-test S/F matrix.
- **Overall** uses the official task rule: a core task counts as solved only if the agent solved every core mode it has (so BEHAVIOR-1K Overall is Astra 38/71, while Standard is 40/71).
- **Suite leaders** for all 32 core suites in the selected setting. Ties stay ties (RoboLab Standard is a four-way 2/6 tie that includes Qwen4 Max). Click a row for every agent's score.
- **Official board** with all four views per agent, checked in tests against the official `exam.json` totals.
- **RoboDojo prompt view**: the published four-row table for GPT-6 Astra and Claude Fable 5.2 on all 54 RoboDojo Standard tasks. It is aggregates only and is not the 37-test core leaderboard column.

## Data

Every number is a published official result from the snapshot vendored on 2026-11-25:

- `src/data/core-results.json`: 11 ranked agents and all 951 core tests (481 Standard, 416 Privileged, 54 Realtime) with official S/F marks, from the EFE website `tasks.json` at commit [`b22e17713317e8e0f891dbc39b99ef7748784d09`](https://github.com/Embodied-First-Exam/embodied-first-exam.github.io/commit/b22e17713317e8e0f891dbc39b99ef7748784d09) (24 November 2026, 8:07:42 PM PT).
- `src/data/aggregates.json`: official view totals, per-suite scores, default pair counts, and the RoboDojo prompt aggregates.
- Exam task-set commit [`258a77cb323f930890cb553e6356f80cb6e6250b`](https://github.com/mll-lab-nu/embodied-first-exam/tree/258a77cb323f930890cb553e6356f80cb6e6250b). Results window: batch evaluation from 2 October to 23 November 2026, latest finished attempt per agent and test.

GPT-6 Luna is `core_off` upstream and is not ranked. The arXiv abstract describes an older 456-task, eight-agent evaluation and is not used as the live board. The older Hugging Face dump (2026-11-21, ten agents) is not mixed in.

## Run

```bash
bun install
bun run dev      # http://localhost:3000
bun test         # scoring unit tests
bun run build
```

No environment variables are required (see `.env.example`). For Vercel, set Root Directory to `apps/efe-agent-arena`.

## Attribution

- Embodied First Exam: [github.com/mll-lab-nu/embodied-first-exam](https://github.com/mll-lab-nu/embodied-first-exam), [site](https://www.embodied-first-exam.ai/), [leaderboard](https://www.embodied-first-exam.ai/leaderboard/), paper [arXiv 2611.12177](https://arxiv.org/abs/2611.12177). GitHub API on 2026-11-25: 323 stars, 19 forks.
- License: [MIT](https://github.com/mll-lab-nu/embodied-first-exam/blob/main/LICENSE), copyright 2026 Kangrui Wang and Embodied First Exam contributors. Third-party simulators, assets, reference solutions, and base images keep their own licenses.
- Bookmark: [x.com/ManlingLi_/status/2125300304648470767](https://x.com/ManlingLi_/status/2125300304648470767).
