# StarVLA Composer: PLAN

## Goal

Build `apps/starvla-composer/`, a single-user Next.js + Bun app in this repository, deployed later to Vercel production (not in this build PR). A visitor picks one brick per layer (backbone, action head, training recipe, benchmark). The app says whether StarVLA supports that combo, links any official Hugging Face checkpoint, and shows published benchmark scores with source links. A small simulated arm shows how each action head turns one camera frame into a chunk of moves. The page is a composer, not a running robot model: there is no GPU inference and no loaded policy.

Source: bookmark https://x.com/JinhuiYe/status/2122753570730893678, repo https://github.com/starVLA/starVLA, site https://starvla.github.io/. Repo created 2025-10-09 8:33 AM PT (GitHub `createdAt` 2025-10-09T15:33:23Z). GitHub API fetched 2026-11-24 around 9:40 AM PT: 3975 stars, 525 forks, default branch `starVLA_dev`, 62 open issues. The marketing homepage on that same morning still showed "3.9K GitHub stars", "519 Forks", and "41+ Checkpoint repos". Those homepage figures are rounded or slightly stale; use the API numbers in the UI source panel, and label the fetch date.

Branches used for this plan:

- Stable `starVLA` HEAD `3422b9f2387b6f682cf02802904a77b23ab13afd` (commit date 2026-05-21 6:45 PM PT, GitHub `2026-05-22T01:45:52Z`). The README tells readers to use this branch for verified results.
- Default / dev `starVLA_dev` HEAD `99764f57339d2d5e1e74f075d32066c5edac78ef` (commit date 2026-11-17 8:24 PM PT, GitHub `2026-11-18T04:24:20Z`). Newer integrations and scores (RoboCasa365 snapshot, Evo-DexBench, later checkpoints) live here.

License: the `LICENSE` file on `starVLA` is titled "MIT License", copyright "StarVLA Team", with two extra clauses (descriptive rebase messages, keep at least the two latest upstream commits separate). The README says the project is released under the MIT License. GitHub's `license` API field is `Other` / `NOASSERTION` because of those extra clauses. Credit it as MIT with those extra fork clauses, and link the file. The codebase was originally forked from InternVLA-M1 (https://github.com/InternRobotics/InternVLA-M1).

Technical report: arXiv 2604.05014. Related: StarVLA-alpha arXiv 2604.11757 (ECCV 2026); VLAct arXiv 2608.27550 (NeurIPS 2026).

## Background (embedded facts; do not re-research)

StarVLA is a modular codebase for turning vision-language models (and some video world models) into vision-language-action policies. The official pitch is Lego-like: swap the backbone, the action head, the training recipe, and the benchmark independently, and reuse one trainer, dataloader, and WebSocket policy server. A framework only needs `forward(...)` to a loss and `predict_action(...)` to actions. Real training and eval need GPUs and separate conda environments; this demo does not run that stack.

### Official bricks

Action heads (checked on both `starVLA` and `starVLA_dev` README "Various VLA Frameworks"; also the homepage and https://starvla.github.io/docs/overview/):

- FAST (framework `QwenFast`): autoregressive discrete action tokens via a fast tokenizer, in the style of pi0-FAST. Official FAST backbones extend the VLM vocabulary. Modified models in the model zoo: `StarVLA/Qwen2.5-VL-3B-Instruct-Action`, `StarVLA/Qwen3-VL-4B-Instruct-Action`, and tokenizer weights `StarVLA/pi-fast`.
- OFT (framework `QwenOFT`): parallel continuous action decoding with an MLP head, in the style of OpenVLA-OFT.
- PI / flow matching (frameworks `QwenPI`, `QwenPI_v3`): a flow-matching action expert for diffusion-style continuous actions, in the style of pi0. The UI label is PI (flow).
- GR00T (framework `QwenGR00T`): dual-system, VLM as System 2 and flow matching as System 1, in the style of GR00T.

Training recipes (README "Various Training Recipes" on `starVLA_dev`, fetched 2026-11-24):

- Supervised fine-tuning (SFT): checked.
- Multimodal multi-objectives co-training: checked. Official SimplerEnv Bridge+Fractal runs are this kind of co-training (Bridge is WidowX, Fractal is Google RT-1).
- Cross-embodiment co-training: checked.
- Reinforcement learning adaptation: still unchecked on that README list. A 2026-04-09 news item says RL post-training is supported via RLinf (https://rlinf.readthedocs.io/en/latest/rst_source/examples/embodied/starvla.html). The homepage lists "RL (RLinf)". Treat RL as docs-supported via RLinf, not as a checked README recipe, and note that the 2026-11-24 Hugging Face snapshot has no official RL-adapted StarVLA checkpoint.

Backbones the composer should offer (homepage brick row plus official zoo / news). Mark the evidence in the UI:

- Qwen2.5-VL 3B: not always on the homepage brick row, but it is the base VLM for many official model-zoo checkpoints.
- Qwen3-VL 4B: homepage "Qwen3-VL"; common official base.
- Qwen3-VL 30B-A3B (MoE): homepage "QwenVL-MoE"; official repos `StarVLA/Qwen3-VL-30B-A3B-OFT-LIBERO` and `StarVLA/Qwen3-VL-30B-A3B-OFT-Bridge-RT1`.
- Qwen3.5 (0.8B, 2B, 4B, 9B): homepage; news 2026-03-03 and https://github.com/starVLA/starVLA/pull/172. No official StarVLA-org finetune in the 45-model snapshot below.
- InternVL: homepage. The repo acknowledges InternVL and ships `M1.py` (InternVLA-M1 lineage). No official StarVLA-org InternVL finetune in the 45-model snapshot.
- Florence-2: homepage; official repo `StarVLA/Florence-GR00T-Bridge-RT-1`. Model zoo WidowX score is "-" (none published there).
- Cosmos-Predict2: homepage world-model backbone (WM4A). Official SimplerEnv scores and HF repos exist (see tables).
- Wan2.2: homepage world-model backbone (WM4A). Official repos include `StarVLA/WM4A-Wan2d2-OFT-LIBERO-4in1` and `StarVLA/Wan2.2-5B-PI-SIMPLE`.
- VLAct Qwen3 pretrain: `StarVLA/VLAct_Qwen3_Pretrain`, advertised as a drop-in `framework.qwenvl.base_vlm` for existing Qwen3-VL-4B recipes (news 2026-08-27). Downstream VLAct finetunes are listed in the catalog below.

Benchmarks:

- Checked on the `starVLA_dev` README list (fetched 2026-11-24): SimplerEnv, LIBERO, LIBERO-plus, RoboCasa-GR1, RoboCasa365, RoboTwin 2.0, DOMINO, BEHAVIOR, Calvin, RoboDojo.
- Unchecked / planned on that same list: SO101, RLBench.
- Homepage also lists Franka (real). Franka is a real-robot example (news 2026-03-19, PR 198), not a published score table in this plan.
- Extra example directories on `starVLA_dev` under `examples/simBenchmarks/` that are not on the checked README list: MetaWorld, VLA-Arena, VLN-CE, Evo-DexBench. Offer them as "example present on starVLA_dev, not on the README checked list". I counted 14 `examples/simBenchmarks/*` directories on `starVLA_dev`. The homepage claims "13 Simulation benchmarks"; do not force those two counts to match.

Additional framework files exist beyond the four official heads (Gemma4, MiniCPM, EgoVLA, ABot_M0, LangForce, PI0, PI05, QwenDual, QwenDiscreteDiffusion, QwenAdapter, ACT, DiffusionPolicy, and world-model OFT/PI/GR00T variants). I counted 28 framework `.py` files on `starVLA_dev` (20 under VLM4A, 6 under WM4A, 2 under VM4A, excluding `__init__.py`). The homepage claims "27 Policy implementations". Do not invent a reconciliation. The composer bricks stay the four official heads; optional extras may appear in a source note, not as first-class undocumented heads.

RoboCasa-GR1 and RoboCasa365 are different benchmarks (GR1 humanoid tabletop vs PandaOmron mobile single arm, 24 vs 50 tasks). The RoboCasa365 README states their checkpoints and scores are not interchangeable.

### Hugging Face catalog (live API, 2026-11-24)

Public org: https://huggingface.co/StarVLA. List endpoint: `https://huggingface.co/api/models?author=StarVLA&limit=200`. One-model endpoint: `https://huggingface.co/api/models/StarVLA/{repo}`. Datasets: `https://huggingface.co/api/datasets?author=StarVLA&limit=200`. No API key is required for these public routes.

The list call returned 45 model repos (not 41). Dataset call returned 9 repos. Collections (10): vlact, robodojo, world-model-to-vla, robotwin-20, robocasa-g1-tabletop, behavior-1k, libero, qwenvl-with-action-token, simplerenv, openx-data-rlds. Do not treat `search=starvla` community forks as official.

The 45 official model ids, with Hugging Face `downloads` and `likes` from that same fetch (downloads are Hub totals at fetch time; they will change):

Modified / tokenizer: `StarVLA/Qwen2.5-VL-3B-Instruct-Action` (158 dl, 1 like), `StarVLA/Qwen3-VL-4B-Instruct-Action` (1691 dl, 3 likes), `StarVLA/pi-fast` (0 dl, 0 likes).

SimplerEnv / Bridge: `StarVLA/Qwen-FAST-Bridge-RT-1`, `StarVLA/Qwen-OFT-Bridge-RT-1`, `StarVLA/Qwen-GR00T-Bridge-RT-1`, `StarVLA/Qwen-PI-Bridge-RT-1`, `StarVLA/Qwen-GR00T-Bridge`, `StarVLA/Qwen3VL-OFT-Bridge-RT-1`, `StarVLA/Qwen3VL-GR00T-Bridge-RT-1`, `StarVLA/Florence-GR00T-Bridge-RT-1`, `StarVLA/Qwen3VL-PI_v3-Bridge-RT_1`, `StarVLA/Qwen3-VL-30B-A3B-OFT-Bridge-RT1`, `StarVLA/Wan2.2-5B-PI-SIMPLE`, `StarVLA/Qwen3-VL-4B-PI-SIMPLE`.

LIBERO: `StarVLA/Qwen2.5-VL-FAST-LIBERO-4in1`, `StarVLA/Qwen2.5-VL-OFT-LIBERO-4in1`, `StarVLA/Qwen2.5-VL-GR00T-LIBERO-4in1`, `StarVLA/Qwen3-VL-OFT-LIBERO-4in1`, `StarVLA/Qwen3-VL-PI-LIBERO-4in1`, `StarVLA/Qwen3-VL-30B-A3B-OFT-LIBERO`, `StarVLA/WM4A-CosmoPredict-GR00T-LIBERO-4in1`, `StarVLA/WM4A-Wan2d2-OFT-LIBERO-4in1`.

RoboCasa GR1: `StarVLA/Qwen3-VL-GR00T-Robocasa-gr1`, `StarVLA/Qwen3-VL-OFT-Robocasa`.

RoboTwin: `StarVLA/Qwen3-VL-OFT-Robotwin2`, `StarVLA/Qwen3-VL-OFT-RoboTwin2-All` (capitalization differs).

BEHAVIOR: `StarVLA/BEHAVIOR-qwendual-state-tast1-chunck50-BEHAVIOR-rgp-seg`, `StarVLA/1115_BEHAVIOR_rgp_dual_QwenDual_task6_40k`, `StarVLA/1117_BEHAVIOR_challenge_QwenDual_task1`, `StarVLA/1120_BEHAVIOR_challenge_QwenDual_taskall`. (Ids are official and oddly spelled; do not "fix" them.)

RoboDojo: `StarVLA/StarVLA-Qwen3vl4b-PIv3-RoboDojo`, `StarVLA/Qwen3vl4b-GR00T-RoboDojo`, `StarVLA/Qwen3vl4b-OFT-RoboDojo`, `StarVLA/VLAct-Qwen3VL4B-OFT-RoboDojo`.

VLAct backbone and finetunes: `StarVLA/VLAct_Qwen3_Pretrain`, `StarVLA/VLAct_Qwen3GR00T_Robotwin_Finetune`, `StarVLA/VLAct_Qwen3OFT_Domino_Finetune`, `StarVLA/VLAct_Qwen3OFT_Robotwin_Finetune`, `StarVLA/VLAct_Qwen3PI_Libero_Plus_Finetune`, `StarVLA/VLAct_Qwen3OFT_Robotwin_all_Finetune`, `StarVLA/VLAct_Qwen3PI_Robotwin_Finetune`, `StarVLA/VLAct_Qwen3PI_VLA_Arena_Finetune`, `StarVLA/VLAct_Qwen3PI_Robotwin_all_Finetune`, `StarVLA/VLAct_Qwen3GR00T_Robotwin_all_Finetune`.

Datasets (9): `StarVLA/BEHAVIOR-1K`, `StarVLA/BEHAVIOR-1K-datasets`, `StarVLA/BEHAVIOR-1K-datasets-assets`, `StarVLA/BEHAVIOR-1K-VISUALIZATION-DEMO`, `StarVLA/LLaVA-OneVision-COCO`, `StarVLA/behavior-1k-task0`, `StarVLA/RoboTwin-Clean`, `StarVLA/RoboTwin-Randomized`, `StarVLA/RoboTwin-Randomized-targz`.

Model-zoo display names do not always match repo ids (for example the zoo row "Qwen2.5-FAST-Bridge-RT-1" is `StarVLA/Qwen-FAST-Bridge-RT-1`). Always link the exact API id.

### Published scores (copy these; do not invent new ones)

All StarVLA numbers below are official pages or READMEs fetched 2026-11-24. When two official tables disagree, show both and name both sources. Never average them together.

**LIBERO** (https://starvla.github.io/docs/benchmarks/libero/): 4 suites, 40 tasks, Franka arm. One policy trained on all 4 suites. "All scores are averaged over 500 trials for each task suite (10 tasks x 50 episodes)." Columns: Spatial, Object, Goal, Long, Avg. StarVLA rows, all at 30K steps / 9.54 epochs:

- StarVLA-FAST (Qwen2.5-VL): 97.3, 97.2, 96.1, 90.2, avg 95.2
- StarVLA-OFT (Qwen2.5-VL): 97.4, 98.0, 96.8, 92.0, avg 96.1
- StarVLA-PI (Qwen2.5-VL): 98.2, 99.2, 95.6, 88.4, avg 95.4
- StarVLA-GR00T (Qwen2.5-VL): 97.8, 98.2, 94.6, 90.8, avg 95.4
- StarVLA-FAST (Qwen3-VL): 97.3, 97.4, 96.3, 90.6, avg 95.4
- StarVLA-OFT (Qwen3-VL): 97.8, 98.6, 96.2, 93.8, avg 96.6
- StarVLA-PI (Qwen3-VL): 98.8, 99.6, 95.8, 88.4, avg 95.7
- StarVLA-GR00T (Qwen3-VL): 97.8, 98.8, 97.4, 92.0, avg 96.5

Comparison rows on that same table (not StarVLA): pi0+FAST avg 85.5, OpenVLA-OFT avg 97.1, pi0 avg 94.1, GR00T-N1.5 avg 86.5. Official HF checkpoints exist for some but not all StarVLA LIBERO rows (for example there is no `Qwen3` FAST, `Qwen2.5` PI, or `Qwen3` GR00T LIBERO repo in the 45-model snapshot, even though those scores are published).

**SimplerEnv WidowX, visual matching** (https://starvla.github.io/docs/benchmarks/simplerenv/): tasks Put Spoon on Towel, Put Carrot on Plate, Stack Green Block on Yellow Block, Put Eggplant in Yellow Basket, then Average. StarVLA rows:

- StarVLA-FAST (Qwen3-VL), 15K: 18.8, 31.3, 4.2, 71.9, avg 31.6
- StarVLA-OFT (Qwen3-VL), 65K: 90.3, 38.5, 29.7, 100.0, avg 64.6
- StarVLA-PI (Qwen3-VL), 40K: 78.1, 46.9, 30.2, 88.5, avg 60.9
- StarVLA-GR00T (Qwen3-VL), 20K: 83.0, 59.4, 18.8, 100.0, avg 65.3
- StarVLA-OFT (Cosmos-Predict2-2B), 30K: 66.8, 62.6, 25.3, 90.2, avg 61.2
- StarVLA-PI (Cosmos-Predict2-2B), 30K: 81.4, 55.2, 25.1, 73.0, avg 58.7
- StarVLA-GR00T (Cosmos-Predict2-2B), 30K: 80.4, 65.4, 20.0, 80.6, avg 61.6

**SimplerEnv Google Robot, visual matching** (same page). Note: "All StarVLA Google Robot results use Qwen3-VL-4B as backbone." Only StarVLA-OFT is reported: Pick Coke Can 95.3, Move Near 75.0, Open/Close Drawer 68.8, Open Top Drawer and Place Apple 66.1, avg 76.0.

**SimplerEnv Google Robot, variant aggregation** (same page), StarVLA-OFT: 91.3, 75.1, 55.0, 59.4, avg 70.2.

**Model zoo WidowX column** (https://starvla.github.io/docs/model-zoo/): "Success rate (%) on WidowX robot tasks in SimplerEnv." This table is not identical to the SimplerEnv eval page.

- Qwen2.5-FAST-Bridge-RT-1 (QwenFast, Qwen2.5-VL-3B, Bridge+Fractal): 58.6, repo `StarVLA/Qwen-FAST-Bridge-RT-1`
- Qwen2.5-OFT-Bridge-RT-1: 41.8, `StarVLA/Qwen-OFT-Bridge-RT-1`
- Qwen2.5-PI-Bridge-RT-1: 62.5, `StarVLA/Qwen-PI-Bridge-RT-1`
- Qwen2.5-GR00T-Bridge-RT-1: 63.6, `StarVLA/Qwen-GR00T-Bridge-RT-1`
- Qwen-GR00T-Bridge (Bridge only): 71.4, `StarVLA/Qwen-GR00T-Bridge`
- Qwen3VL-OFT-Bridge-RT-1: 42.7, `StarVLA/Qwen3VL-OFT-Bridge-RT-1`
- Qwen3VL-GR00T-Bridge-RT-1: 65.3, `StarVLA/Qwen3VL-GR00T-Bridge-RT-1`
- Florence-GR00T-Bridge-RT-1: "-", `StarVLA/Florence-GR00T-Bridge-RT-1`

Discrepancy to keep visible: Qwen3VL-GR00T-Bridge-RT-1 is 65.3 in both places, good. Qwen3VL-OFT-Bridge-RT-1 is 42.7 in the model zoo but the eval-page StarVLA-OFT (Qwen3-VL) average is 64.6 at 65K steps. Do not pick one. Show both, with sources, and do not invent an explanation.

**RoboCasa GR1 tabletop** (https://starvla.github.io/docs/benchmarks/robocasa/): 24 pick-and-place tasks, Fourier GR1 upper body, dual arms. "A single model was trained for all 24 tasks. Results are reported over 50 rollouts per task." Averages only (per-task table is on that page; if the UI drills in, copy the official per-task numbers from that page, do not invent them):

- GR00T-N1.6 (baseline): 47.6
- StarVLA-GR00T-Qwen3: 47.8, official repo `StarVLA/Qwen3-VL-GR00T-Robocasa-gr1`
- StarVLA-PI-Qwen3: 43.9 (no official PI RoboCasa GR1 repo in the 45-model snapshot)
- StarVLA-OFT-Qwen3: 48.8, official repo `StarVLA/Qwen3-VL-OFT-Robocasa`
- StarVLA-FAST-Qwen3: 39.0 (no official FAST RoboCasa GR1 repo in the 45-model snapshot)

**RoboTwin 2.0** (https://starvla.github.io/docs/benchmarks/robotwin/): 50 tasks, Easy / Hard. "All 50 tasks are trained within a single model, using 50 clean and 500 randomized demonstrations per task for co-training." Official averages:

- StarVLA-OFT: Easy 88.18, Hard 88.32
- Comparison averages on the same table: pi0 65.92 / 58.40, pi0.5 82.74 / 76.76, X-VLA 72.80 / 72.84, Motus 88.66 / 87.02, lingbot-vla without depth 86.50 / 85.34, lingbot-vla with depth 88.56 / 86.68

Official OFT repos: `StarVLA/Qwen3-VL-OFT-Robotwin2` and `StarVLA/Qwen3-VL-OFT-RoboTwin2-All`. The results page does not say which of those two produced 88.18 / 88.32. Link both and say the page does not disambiguate. Per-task official numbers live on that page; do not invent them. VLAct also has RoboTwin finetunes; do not assign the 88.18 / 88.32 averages to VLAct cards.

**RoboCasa365** (dev README news 2026-09-05, and `examples/simBenchmarks/Robocasa_365/README.md` on `starVLA_dev`): 50 tasks, PandaOmron, local research snapshot dated 2026-08-30, RoboCasa v1.0.1, 50 tasks x 50 rollouts = 2,500 rollouts, target kitchens. "Not official RoboCasa leaderboard submissions" and "cannot be reproduced from this README alone" (checkpoints and raw logs are not checked in). No RoboCasa365 repo is in the 45-model snapshot. Headline aggregates:

- StarVLA-OFT: overall 33.32% (833/2500); Atomic-Seen 65.22% (587/900); Composite-Seen 15.62% (125/800); Composite-Unseen 15.12% (121/800)
- StarVLA-OFT (no state): 30.92% (773/2500); 63.78% (574/900); 13.50% (108/800); 11.38% (91/800)
- StarVLA-PI: 40.64% (1016/2500); 76.56% (689/900); 39.38% (315/800); 1.50% (12/800). This is the "best selected local result".
- StarVLA-GR00T: 39.24% (981/2500); 76.67% (690/900); 35.38% (283/800); 1.00% (8/800)

Always repeat the local-research disclaimer when showing these numbers.

**Calvin** (`examples/simBenchmarks/calvin/README.md` on `starVLA_dev`, "Benchmark Results (Calvin)", conducted by the UNT team). Columns: Avg. Length, Task 1 to Task 5. Rows:

- PI0* : 2.954, 84.8%, 70.4%, 55.9%, 46.6%, 37.7%
- PI0.5* : 3.885, 92.5%, 84.0%, 76.6%, 71.0%, 64.4%
- qwenpi (qwen2.5-vl-3B-instruct-action): 3.576, 90.9%, 79.5%, 69.6%, 62.2%, 55.4%
- qwenpi (qwen3-vl-4B-instruct): 3.472, 87.7%, 75.2%, 67.4%, 61.8%, 55.1%
- qwengr00t (qwen2.5-vl-3B-instruct): 3.697, 91.7%, 81.9%, 72.7%, 65.3%, 58.1%
- qwengr00t (qwen2.5-vl-3B-instruct-action): 3.786, 92.5%, 83.9%, 74.4%, 67.9%, 59.9%
- qwengr00t (qwen3-vl-4B-instruct): 3.645, 89.8%, 79.9%, 71.8%, 64.9%, 58.1%
- qwengr00t (qwen3-vl-4B-instruct-action): 3.757, 91.1%, 81.8%, 74.1%, 67.6%, 61.1%

The README says models marked `*` were "trained by us" and "Other experimental results will be released soon." No Calvin-named repo is in the 45-model snapshot. Do not invent a Hugging Face id.

**BEHAVIOR, DOMINO, LIBERO-plus, RoboDojo:** official checkpoints exist for some (see catalog). This plan does not vendor official numeric leaderboards for them (the BEHAVIOR docs page was still "under active development" when fetched). You may link the checkpoint and say "no official score is recorded in this PLAN". Do not invent one.

### How to decide combo support

Implement a deterministic function, covered by unit tests, over the four bricks. Possible statuses:

1. `official_checkpoint_and_score`: an official StarVLA repo in the catalog matches this combo, and this PLAN records an official score. Show both, with source URLs.
2. `official_checkpoint_only`: official repo, no score in this PLAN.
3. `official_score_only`: official score in this PLAN, no matching StarVLA-org repo in the 2026-11-24 snapshot (example: StarVLA-FAST Qwen3 on LIBERO, StarVLA-PI Qwen3 on RoboCasa GR1, RoboCasa365 local snapshot).
4. `framework_supported_no_official_release`: the backbone and head exist as code paths (Qwen or WM4A frameworks, or a documented news integration such as Qwen3.5 / InternVL / RLinf), but this PLAN has neither an official repo nor an official score for that exact combo.
5. `not_supported_or_planned`: unchecked README benchmarks (SO101, RLBench), or a brick the repo does not claim.

Constraints to encode (honest caveats, not silent blocks unless the official docs require the constraint):

- FAST officially ships with the Action-token VLMs and `pi-fast` tokenizer. If the user pairs FAST with a plain Instruct or world-model backbone, say that the official FAST releases use the Action-token models.
- RoboCasa-GR1 and RoboCasa365 are not interchangeable.
- Recipe "multimodal co-training" is the right label for official Bridge+Fractal SimplerEnv checkpoints; "SFT" is reasonable for single-benchmark finetunes when the source does not say otherwise. If the source is silent, do not over-claim a recipe.
- RL is docs-supported via RLinf, README-unchecked, no official RL checkpoint in the snapshot.
- Never invent a Hugging Face id or a score. If two official sources disagree, show both.

Default first-load combo (must be status 1): backbone Qwen3-VL 4B, head GR00T, recipe multimodal co-training (Bridge+Fractal), benchmark SimplerEnv (WidowX). Official repo `StarVLA/Qwen3VL-GR00T-Bridge-RT-1`. Official average 65.3 from both the SimplerEnv eval page (20K steps, per-task 83.0 / 59.4 / 18.8 / 100.0) and the model zoo WidowX column.

## MVP and acceptance criteria

1. **Composer on first load, already filled.** The default view is the default combo above, already resolved: a clear support badge, the official Hugging Face id as a link, published WidowX scores with source links, and the simulated arm visible (not a blank form). Other bricks are one click or one select away. This path works with zero secrets.
2. **One brick per layer.** Controls for backbone, action head, recipe, and benchmark. Changing any brick re-resolves support, checkpoints, and scores immediately. The UI states, in plain language, that this is a composer for official StarVLA combos, not a running policy and not GPU inference.
3. **Live Hugging Face lookup.** A server-only route (for example `/api/checkpoints`) fetches official model metadata from the public Hub API (`https://huggingface.co/api/models/StarVLA/...` and optionally the author list). Show lastModified, downloads, likes, and the model page link when the live call succeeds. If the route times out, the Hub errors, or the network fails, keep the vendored 2026-11-24 catalog on screen and show a visible "live lookup unavailable" state. Do not silently pretend a cached card is live. Cap timeout (about 8 to 10 s is enough), no infinite retry, conservative per-IP cooldown. No API key and no new secret names. A first-paint or status flag may tell the client the route is reachable without exposing internals.
4. **Published scores with sources.** When this PLAN has a score for the combo, show the number, the split (suite or task) if official, and a link to the exact source page. When it does not, say so. When two official tables disagree (Qwen3 OFT WidowX 42.7 vs 64.6), show both.
5. **Simulated arm.** A small schematic arm (SVG, canvas, or a light three.js scene is fine) plus one illustrated camera frame. A Play control runs a short animation that differs by action head:
   - FAST: discrete tokens appear one after another, then a continuous chunk is decoded, then the arm follows the chunk.
   - OFT: the full continuous chunk appears at once, then the arm follows.
   - PI: a noisy trajectory is refined over several steps into a clean chunk (flow matching), then the arm follows.
   - GR00T: a short System 2 plan beat, then System 1 flow-matching refines a chunk, then the arm follows.
   Label the viewport SIMULATION. Caption, required: "This is a schematic of how the action head turns one frame into a chunk of moves. It is not policy inference and does not load a checkpoint." Example chunk lengths may be labeled 8 or 16 steps, with a note that real horizons vary (RoboCasa365 public QwenOFT uses horizon 16; the RoboCasa GR1 eval example uses `n_action_steps` 12). Stop returns to rest. This path uses no model weights.
6. **Look, provenance, limits.** Light paper-studio lab chrome, strong typography, brick/composer layout. Not a dark admin dashboard and not a raw JSON dump. A source panel links the bookmark, the GitHub repo, the site, both branch SHAs above, the LICENSE (MIT with extra rebase clauses), the Hugging Face org, and the arXiv report 2604.05014. Plainly state the GitHub star/fork counts and the 45 official model repos came from the APIs on 2026-11-24.

## MVP outs

- Loading or running any StarVLA checkpoint, ONNX, WASM policy, or GPU / WebGPU inference.
- Connecting to a real or simulated WebSocket policy server, or driving a real robot.
- Training, fine-tuning, or uploading models.
- Inventing scores, unofficial Hugging Face ids, or undocumented heads as first-class bricks.
- Accounts, billing, or a public gallery of user combos.
- Creating the Vercel project, editing the root README Live demos table, creating a new GitHub repo, or touching sibling apps.

## Stack

- Next.js App Router, React and TypeScript, matching recent sibling apps. Bun for everything. Write `bunfig.toml` with `[install] minimumReleaseAge = 259200` before the first install. `bun install`, `bun run dev`, `bun run build`.
- shadcn/ui for the composer chrome (brick pickers, badges, source panel, score table). A small SVG/canvas/three schematic for the arm is enough; do not take a heavy 3D dependency unless it stays small and builds cleanly.
- Server-only route for Hugging Face Hub lookups. Zero secrets. Public API only.
- Vercel Root Directory `apps/starvla-composer`. `vercel.json` only if needed. Commit `.env.example` (state that no secrets are required) and add a `!.env.example` line to the app `.gitignore`.

## Tasks

1. Scaffold the app under `apps/starvla-composer/` only. bunfig first, then install, then shadcn as needed.
2. Vendor the brick lists, official 45-model catalog, and the score tables from this PLAN as typed data (with source URLs). Unit tests for combo resolution, score lookup, Hub payload parsing, and simulation state (token ticks vs parallel chunk vs denoising vs dual-system).
3. Build the composer UI: default combo on first load, brick pickers, support badge, score panel, source panel, honest empty and disagreement states.
4. Implement the serverless Hub lookup route with timeout, fallback to the vendored catalog, and a visible live/unavailable label.
5. Implement the simulated arm animations for the four official heads, with the required SIMULATION caption.
6. README: what the composer is and is not, attribution (StarVLA MIT with extra clauses, bookmark, site, SHAs, arXiv 2604.05014), how to run, that no env vars are required. `.env.example` as above.

## Screenshot proof requirements

In the PR body link a Claude artifact (hosted off-repo; commit no media) with a short video or stills showing: (1) first load of the default Qwen3-VL 4B + GR00T + Bridge+Fractal + SimplerEnv combo, with the 65.3 score, the official HF id, and the arm visible, (2) changing a brick (for example to FAST or to RoboCasa365) so the support badge and scores update honestly, including at least one "score only" or "checkpoint only" or "no official release" state, (3) Play of the simulated arm for at least two heads, with the SIMULATION caption visible, (4) the source panel, and (5) the failed or offline Hub lookup still showing the vendored catalog plus a visible unavailable state. Screenshots must show real content, not a blank or loading state.

## Build instructions for the Claude Code routine

Build only in `apps/starvla-composer/` plus, in the ship PR, moving tracking id `2122753570730893678` (slug `starvla-composer`) from `proposed` to `built` in `tracking/seen-bookmarks.json`. Branch `demo-starvla-composer`, one PR to `main`. Follow the acceptance criteria above; do not defer the default combo, the support resolver, the live Hub route, or the simulated arm. Do not create the Vercel project, do not edit the root README Live demos table, do not create a repo, do not touch sibling apps. Do not load model weights. Credit StarVLA and the MIT license (with the extra rebase clauses) in the README. No em dashes or en dashes anywhere you write (README, PR body, commits, UI copy, a generated `AGENTS.md`; replace them if a generator adds them). If a link in this PLAN or the fire text fails to load, use the facts already embedded here and stop to report the failed link rather than searching elsewhere or inventing numbers.

## Deferred

- Any live policy inference, even a tiny ONNX head.
- Per-task drill-down tables beyond what this PLAN already vendors, except official per-task numbers copied from a source already named here (RoboCasa GR1 and RoboTwin pages).
- A visual copy of the official Overleaf report (https://www.overleaf.com/read/qqtwrnprctkf#d5bdce) or of unpublished BEHAVIOR / DOMINO leaderboards.
- Switching the Demo App Builder routine itself to Sonnet (out of scope for this app).
