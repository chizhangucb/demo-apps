# EFE Agent Arena: PLAN

## Goal

Build `apps/efe-agent-arena/`, a single-user Next.js + Bun app in this repository, deployed later to Vercel production (not in this build PR). A visitor picks any two official ranked agents and a setting (Standard, Privileged, or Realtime, plus an Overall view). The app shows which core tests each agent solved that the other failed, lists those tests by suite, and shows the leader or tied leaders in each of the 32 core suites. A RoboDojo prompt view shows the published effect of changing the goal text on all 54 RoboDojo Standard tasks. The page is a scoreboard of published results. It does not run Harbor, a simulator, or a coding agent, and it needs no API keys.

Source: bookmark https://x.com/ManlingLi_/status/2125300304648470767, repo https://github.com/mll-lab-nu/embodied-first-exam, site https://www.embodied-first-exam.ai/, leaderboard https://www.embodied-first-exam.ai/leaderboard/, paper https://arxiv.org/abs/2611.12177 (arXiv 2611.12177). Repo created 18 September 2026, 4:01 AM PT (GitHub `createdAt` 2026-09-18T11:01:00Z). GitHub API fetched 2026-11-25 at 9:23 AM PT: 323 stars, 19 forks, default branch `main`, 7 open issues, license MIT. Homepage https://www.embodied-first-exam.ai. The official site data used below is website commit `b22e17713317e8e0f891dbc39b99ef7748784d09` (commit date 24 November 2026, 8:07:42 PM PT, GitHub `2026-11-25T04:07:42Z`), with `exam.json` `build.at` `2026-11-25T04:07:10+00:00` (24 November 2026, 8:07:10 PM PT). That site build reads the exam repo at `258a77cb323f930890cb553e6356f80cb6e6250b` (`task_set.date` 2026-11-24T22:05:39-06:00, which is 24 November 2026, 8:05:39 PM PT). The exam repo `main` HEAD at 9:18 AM PT on 2026-11-25 was later, `408d08eee19d6e7a428cd3418dc643242dc38cb8` (2:43:59 AM PT the same day, GitHub `2026-11-25T10:43:59Z`); those later commits change task wording (RoboEngineer, RoboDojo, RoboARC IKEA) and are not the result snapshot. The leaderboard page footer on the morning of 2026-11-25 read "Questions as of 24 November 2026 · results updated 24 November 2026". The `exam.json` leaderboard note says the counts are "Results of the batch evaluation from 2 October to 23 November 2026: the latest finished attempt per agent and test."

License: MIT. The `LICENSE` file is a standard MIT text, copyright "2026 Kangrui Wang and Embodied First Exam contributors". The README license section says MIT covers the code in the repository, and that third-party simulators, assets, reference solutions derived from upstream experts, and the contents of the base images keep their own licenses. GitHub's license field is MIT. Credit it as MIT, link the file, and keep that third-party caveat.

## Background (embedded facts; do not re-research)

Embodied First Exam (EFE) is an agentic robotics benchmark for coding agents. In each task the agent writes a program that controls a robot in a frozen simulator scene, and a separate sandbox marks the answer. The agent may control the robot directly, write code to control it, or train a policy to control it. Runs go through Harbor. The official homepage, README, and `exam.json` totals all say 1,156 tasks, 35 suites, and 47 robots. Nine of the suites are EFE originals (DexHandExam, Embodied Olympics Fun, Embodied Olympics Match, Embodied Safety Exam, iSpatialGym, RoboARC, RoboDynamicExam, RoboEngineer, RoboPaint). The other 26 are adapted from existing benchmarks. Three suites (ABC Sim, AutoBio, LabUtopia) have no tasks in the official core set, so they do not appear on the leaderboard.

Each task can run in up to three settings that share the scene, success check, and time limit:

- Standard: the agent sees only the robot's sensors and, by default, cannot reset the episode, as with a real robot.
- Privileged: the agent gets the full simulator state and unlimited resets. A privileged answer is replayed in a fresh process.
- Realtime: like Standard, except the world keeps running while the agent thinks.

The official board uses a hard core set, not every task. In this snapshot: 481 core tasks and 951 core tests (416 Privileged, 481 Standard, 54 Realtime). `tasks.json` also contains 675 tasks labelled `easy`; those are not on the official leaderboard. Do not rank agents on the easy set. Overall counts each core task once, and a task counts as solved only if the agent solved every core mode it has. Standard, Privileged, and Realtime each count every core test of that mode. Success is the official `S` mark, which the Hugging Face leaderboard README defines as verifier reward of at least 1 within the token budget. Each ranked agent has one counted attempt per test. Official caveats to show in the source panel: differences of a few tests, especially in a small suite or in Realtime, may come from variation between runs; each result belongs to a model in its harness; all results are in simulation; models may remember solutions of public benchmarks that some suites adapt.

### Ranked agents and headline scores

Eleven agents are on the official board (`exam.json` `leaderboard.shared.runs`). GPT-6 Luna (`codex-gpt6_luna-xhigh`) appears in `exam.json` `runs` but is listed in `leaderboard.shared.core_off` and is not ranked. Do not put Luna on the board.

Headline scores below are from `exam.json` `leaderboard.shared.views` at the site commit above. They were recomputed from the vendored per-test matrix in `PLAN-data/core-results.json` and match exactly. Percents use one decimal, matching the official GPT-6.2 Astra post and the Hugging Face leaderboard README. The homepage bar chart rounds the Overall column to an integer percent (54%, 47%, and so on); show the count and the one-decimal rate, not only the rounded bar.

| Rank | Agent | Harness | Overall | Standard | Privileged | Realtime |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | GPT-6.2 Astra | Codex, high | 54.1% (260/481) | 58.0% (279/481) | 95.0% (395/416) | 40.7% (22/54) |
| 2 | Claude Fable 5.2 | Claude Code, high | 46.8% (225/481) | 51.6% (248/481) | 81.0% (337/416) | 40.7% (22/54) |
| 3 | GPT-6 Astra | Codex, high | 33.7% (162/481) | 36.4% (175/481) | 80.0% (333/416) | 31.5% (17/54) |
| 4 | GPT-6.1 Sol | Codex, high | 31.4% (151/481) | 33.9% (163/481) | 74.3% (309/416) | 24.1% (13/54) |
| 5 | Claude Opus 5.5 | Claude Code, high | 24.3% (117/481) | 27.0% (130/481) | 61.8% (257/416) | 7.4% (4/54) |
| 6 | Gemini 4 Argon | Antigravity, high | 20.2% (97/481) | 26.4% (127/481) | 45.2% (188/416) | 9.3% (5/54) |
| 7 | Kimi 3.1 Pro | Claude Code, high | 9.1% (44/481) | 11.4% (55/481) | 39.7% (165/416) | 7.4% (4/54) |
| 8 | Qwen4 Max | Claude Code, high | 6.7% (32/481) | 8.1% (39/481) | 26.0% (108/416) | 5.6% (3/54) |
| 9 | Gemini 3.8 Flash | Antigravity, high | 5.2% (25/481) | 6.7% (32/481) | 24.5% (102/416) | 1.9% (1/54) |
| 10 | DeepSeek V4.1 Flash | DeepSeek Harness, high | 2.9% (14/481) | 3.5% (17/481) | 17.5% (73/416) | 1.9% (1/54) |
| 11 | GLM 5.3 Flash | Claude Code, high | 2.3% (11/481) | 2.5% (12/481) | 10.6% (44/416) | 0.0% (0/54) |

Qwen4 Max is on this 11-agent board and is not in the older Hugging Face `leaderboard/` dump dated 2026-11-21, which has ten agents and the same headline counts for those ten. The failure-analysis post speaks of ten agents. Use this 11-agent matrix as the live board, and say when a cited post used ten.

### Default pair: GPT-6.2 Astra vs Claude Fable 5.2

Recomputed from the vendored matrix (and matching the failure-analysis post for Standard and Privileged):

| Setting | Tests | Only Astra | Only Fable | Both solved | Neither |
| --- | --- | --- | --- | --- | --- |
| Standard | 481 | 96 | 65 | 183 | 137 |
| Privileged | 416 | 63 | 5 | 332 | 16 |
| Realtime | 54 | 6 | 6 | 16 | 26 |
| Overall | 481 | 94 | 59 | 166 | 162 |

Any other pair must be computed the same way from the matrix, not invented. In Standard, 111 tests are solved by none of the 11 ranked agents, and 169 stay unsolved if GPT-6.2 Astra is removed. The failure-analysis post, written against ten agents, said 112 and 170. Show the matrix counts as the live board and mention that the post used ten agents.

### Suite leaders (core tests, from the same matrix)

Render all 32 core suites, with ties shown as ties, from `PLAN-data/aggregates.json` `suite_scores` or by grouping the matrix. Do not use the Overall column when the toggle is Standard, or the other way around. The public leaderboard "suite by suite" table has separate views for Overall, Standard, Privileged, and Realtime. A common mix-up: BEHAVIOR-1K Overall is Astra 38/71 and Fable 19/71, but Standard is Astra 40/71 and Fable 26/71. The failure-analysis post quotes the Standard test counts (40 and 26).

Notable Standard leaders, all from the matrix (these match the failure-analysis post except where noted):

- RoboPaint, Standard, 22 tests: GPT-6.2 Astra 21/22, then GPT-6 Astra 7/22, GPT-6.1 Sol 6/22, and Claude Fable 5.2, Gemini 4 Argon, and Claude Opus 5.5 tied at 2/22.
- BEHAVIOR-1K, Standard, 71 tests: GPT-6.2 Astra 40/71, Claude Fable 5.2 26/71, GPT-6 Astra 14/71. Privileged: Astra 67/71, then GPT-6.1 Sol 38/71, then Fable and GPT-6 Astra tied at 36/71.
- DexHandExam, Standard, 23 tests: GPT-6.2 Astra 20/23. MuJoCo Playground, Standard, 7 tests: Astra 7/7. MyoSuite, Standard, 13 tests: Astra 7/13. DexToolBench, Standard, 20 tests: Astra 4/20. Privileged DexToolBench: Astra 17/20, GPT-6 Astra 13/20.
- Embodied Safety Exam, Standard, 50 tests: Claude Fable 5.2 35/50, GPT-6 Astra 32/50, GPT-6.2 Astra 27/50.
- RoboDojo, Standard, 37 tests: Claude Fable 5.2 28/37, GPT-6.2 Astra 22/37, then Gemini 4 Argon and GPT-6 Astra tied at 21/37. Privileged: GPT-6.2 Astra 37/37, Fable 36/37.
- RoboEngineer, Standard, 15 tests (this suite has no Privileged core tests): Claude Fable 5.2 7/15, GPT-6 Astra 5/15, GPT-6.2 Astra 3/15.
- Embodied Olympics Match, Standard, 13 tests: Claude Fable 5.2 10/13, GPT-6.2 Astra 9/13.
- ManiGuard, Standard, 7 tests: Claude Opus 5.5 7/7, and no other ranked agent solves all seven. Fable 6/7, Sol 5/7, Astra 4/7.
- RoboLab, Standard, 6 tests: four-way tie at 2/6 among GPT-6.2 Astra, Claude Fable 5.2, GPT-6.1 Sol, and Qwen4 Max. The failure-analysis post, before Qwen4 Max was on the board, said Sol shares the lead with Astra and Fable.
- RoboARC, Standard, 58 tests: Claude Fable 5.2 33/58, GPT-6.2 Astra 32/58. The failure-analysis post said Fable solves "32 of 50 puzzles" and Astra 31 of 50. That 50-puzzle cut is not the 58-test Standard core column on the live board. Show 33/58 and 32/58 as the official suite score, and if you quote the post, label it as a 50-puzzle wording from the post, not as the live suite total.
- HumanoidBench, Standard, 8 tests: GPT-6 Astra 1/8, and the other ten ranked agents 0/8.

### RoboDojo prompt effect (published aggregates only)

Source: https://www.embodied-first-exam.ai/suite/robodojo/ fetched 2026-11-25 around 9:22 AM PT. The report at https://www.embodied-first-exam.ai/blogs/agentic-robotics-benchmark/ publishes the GPT-6 Astra column only (12/54, 33/54, 37/54). This table is all 54 RoboDojo tasks in the Standard Setting, not only the 37 core tasks on the leaderboard. Only GPT-6 Astra and Claude Fable 5.2 are published. GPT-6.2 Astra is not in this table. The page says scenes, step limits, and success checkers stayed the same, and that the leaderboard uses the fully specified prompt. Per-task marks for the three prompts and the RoboDojo harness are not published. Show this table as aggregates, and do not invent a per-task prompt matrix.

| Prompt or harness | GPT-6 Astra | Claude Fable 5.2 |
| --- | --- | --- |
| VLA prompt: RoboDojo's one-sentence task description | 22% (12/54) | 63% (34/54) |
| RoboDojo agent prompt (same sentence, plus the task recipe and the return-to-start note from RoboDojo's GPT-6 Astra evaluation) | 61% (33/54) | 74% (40/54) |
| Fully specified prompt (EFE): every condition the success checker tests, including that both arms end near their start pose. The leaderboard uses this prompt. | 69% (37/54) | 81% (44/54) |
| RoboDojo agent harness: the agent prompt in RoboDojo's own harness instead of Codex or Claude Code; the model sets end-effector targets and RoboDojo's motion planner moves the arms | 24% (13/54) | 28% (15/54) |

A clearer goal text lifts Fable from 63% (34/54) to 81% (44/54), and GPT-6 Astra from 22% (12/54) to 69% (37/54). Do not call the 44/54 figure a core-set score, and do not mix it with Fable's 28/37 core Standard leaderboard number.

### Vendored snapshot (use these files; do not re-fetch)

The plan PR vendors official data under `apps/efe-agent-arena/PLAN-data/`:

- `core-results.json`: the 11 ranked agents and all 951 core tests. Each test has `suite`, `id`, `title`, `setting`, and a `v` string of 11 characters (`S` or `F`) in `agent_order`. Built from official `tasks.json` at the site commit above. Official task pages use `https://www.embodied-first-exam.ai/tasks/?task={suite}/{id}` (the slash is URL-encoded).
- `aggregates.json`: official view totals, per-suite scores, the default pair counts, and the RoboDojo prompt table, with source URLs and dates.

Copy these into the app as typed data. Unit tests must check that totals recomputed from the matrix match `aggregates.json` / the table in this PLAN. If a source URL later fails to load, keep using these files and report the failed link. Do not scrape a newer board, do not invent marks, and do not fill gaps from the paper or from the older Hugging Face dump.

### Older official sources, and how they differ

- Hugging Face dataset `MLL-Lab/embodied-exam-data`, path `leaderboard/`, snapshot date 2026-11-21, newest counted trial finished 2026-11-20T21:59:34Z, exam commit `88dc065f83`, ten agents, no Qwen4 Max. `numbers.json` headline counts for those ten agents match this snapshot. `leaderboard_core.csv` and `trials.csv` are the downloadable per-attempt dump for that older cut, including run viewer slugs. This app vendors the later 11-agent website matrix, not that dump. Do not mix the two, and do not invent run-viewer links for the 11-agent board from the older files.
- The arXiv paper 2611.12177 abstract still describes an earlier evaluation: 456 core tasks, eight agents, and "the strongest of eight agents, GPT-6 Astra in Codex, achieves a success rate of 34% in the Standard Setting." That is not the live 481-task, 11-agent board, where GPT-6.2 Astra leads at 58.0% (279/481) Standard. Link the paper in the source panel, and do not use its abstract numbers as the live scores.

README News: released 19 October 2026; failure-analysis post dated 12 November 2026 in the exam README.

## MVP and acceptance criteria

1. **Scoreboard on first load, already filled.** The default view is GPT-6.2 Astra vs Claude Fable 5.2 in the Standard Setting, already resolved: the 96 / 65 / 183 / 137 pair counts, a visible list of the tests only one of them solves (grouped by suite, with official titles), and the Standard suite leaders, including RoboPaint (Astra 21/22), Embodied Safety Exam (Fable 35/50), ManiGuard (Opus 7/7), and RoboDojo (Fable 28/37). Not a blank form. This path works with zero secrets.
2. **Pair picker and setting toggle.** The visitor can pick any two of the 11 ranked agents and switch among Standard, Privileged, Realtime, and Overall. The unique-solve lists and the pair counts recompute from the vendored matrix immediately and honestly, including ties and empty unique lists. Overall uses the official task rule (every core mode solved). The UI states, in plain language, that this is a scoreboard of published EFE results, not a running exam and not a simulator.
3. **Suite leaders.** A suite table or board for all 32 core suites in the current setting, with the leader or tied leaders, solved/tested counts, and a way to open one suite's per-agent scores. Ties stay ties.
4. **RoboDojo prompt view.** A dedicated view or panel shows the published four-row prompt table above, with the 54-task scope, the two-agent limit, the note that the leaderboard uses the fully specified prompt, and the lift from 63% (34/54) to 81% (44/54) for Fable and from 22% (12/54) to 69% (37/54) for GPT-6 Astra. Do not present 44/54 as a 37-test core score.
5. **Look, provenance, limits.** Light paper-exam scoreboard chrome, strong typography. Not a dark admin dashboard and not a raw JSON dump. A source panel links the bookmark, the GitHub repo, the site, the leaderboard, the failure-analysis post, the RoboDojo suite page, the report, the paper (arXiv 2611.12177), the LICENSE (MIT, with the third-party caveat), and the website commit / exam task-set SHA above. Plainly state the GitHub star and fork counts came from the API on 2026-11-25, and that the scores are the official board as of the 24 November 2026 result update, vendored on 2026-11-25. Optional: a test title may link the official task page with `https://www.embodied-first-exam.ai/tasks/?task={suite}/{id}`. Do not invent run-replay URLs.

## MVP outs

- Running Harbor, any simulator, any coding agent, or any live EFE evaluation.
- Loading trajectories, videos, or run traces as a required path (linking an official task page is enough).
- Inventing per-task marks for the RoboDojo prompt ablation, unofficial agents, or the easy set as a second official board.
- Scraping a newer leaderboard at runtime, or mixing the 21 November Hugging Face dump with this 11-agent matrix.
- Using the paper's 456-task / eight-agent / 34% abstract as the live scoreboard.
- Accounts, billing, or a public gallery of user pairs.
- Creating the Vercel project, editing the root README Live demos table, creating a new GitHub repo, or touching sibling apps.

## Stack

- Next.js App Router, React and TypeScript, matching recent sibling apps. Bun for everything. Write `bunfig.toml` with `[install] minimumReleaseAge = 259200` before the first install. `bun install`, `bun run dev`, `bun run build`.
- shadcn/ui for the scoreboard chrome (agent pickers, setting toggle, pair lists, suite table, source panel).
- Zero secrets. No server route is required. The Vercel demo must work with no env vars.
- Vercel Root Directory `apps/efe-agent-arena`. `vercel.json` only if needed. Commit `.env.example` (state that no secrets are required) and add a `!.env.example` line to the app `.gitignore`.

## Tasks

1. Scaffold the app under `apps/efe-agent-arena/` only. bunfig first, then install, then shadcn as needed.
2. Vendor `PLAN-data/core-results.json` and `PLAN-data/aggregates.json` as typed data (keep the source URLs and dates). Unit tests for pair diffs, the Overall task rule, suite leaders (including ties), setting filters, headline total checks against the official view scores, and the RoboDojo prompt table lookup.
3. Build the scoreboard UI: default Astra vs Fable Standard view already filled, agent pickers, setting toggle, unique-solve lists grouped by suite, suite leaders, RoboDojo prompt view, source panel, honest empty and tie states.
4. README: what the scoreboard is and is not, attribution (EFE MIT with the third-party caveat, bookmark, site, SHAs, arXiv 2611.12177), how to run, that no env vars are required, and that every number is a published official result from the vendored 2026-11-25 snapshot. `.env.example` as above.

## Screenshot proof requirements

In the PR body link a Claude artifact (hosted off-repo; commit no media) with a short video or stills showing: (1) first load of GPT-6.2 Astra vs Claude Fable 5.2 in Standard, with the 96 / 65 / 183 / 137 counts and a visible unique-solve list, (2) the Standard suite leaders, including RoboPaint, Embodied Safety Exam, ManiGuard, and RoboDojo, (3) switching the toggle to Privileged so the pair counts become 63 / 5 / 332 / 16, (4) the RoboDojo prompt view with the 63% to 81% Fable lift and the 54-task / two-agent scope caption, and (5) the source panel. Screenshots must show real content, not a blank or loading state.

## Build instructions for the Claude Code routine

Build only in `apps/efe-agent-arena/` plus, in the ship PR, moving tracking id `2125300304648470767` (slug `efe-agent-arena`) from `proposed` to `built` in `tracking/seen-bookmarks.json`. Branch `demo-efe-agent-arena`, one PR to `main`. Follow the acceptance criteria above; do not defer the default pair view, the setting toggle, the suite leaders, or the RoboDojo prompt view. Do not create the Vercel project, do not edit the root README Live demos table, do not create a repo, do not touch sibling apps. Do not run a simulator. Credit Embodied First Exam and the MIT license (with the third-party caveat) in the README. No em dashes or en dashes anywhere you write (README, PR body, commits, UI copy, a generated `AGENTS.md`; replace them if a generator adds them). If a link in this PLAN or the fire text fails to load, use the facts and files already embedded here and stop to report the failed link rather than searching elsewhere or inventing numbers.

## Deferred

- Live refresh of official `exam.json` / `tasks.json`.
- Run-replay viewers or Hugging Face `embodied-exam-runs` media.
- An easy-set explorer (those 675 tasks are not the official board).
- Ranking GPT-6 Luna or any other `core_off` run.
- Switching the Demo App Builder routine itself to Sonnet (out of scope for this app).
