# StarVLA Composer

Pick one StarVLA brick per layer (backbone, action head, training recipe, benchmark). The composer says whether StarVLA officially supports that combo, links any official Hugging Face checkpoint, and shows published benchmark scores with links to their sources. A small schematic arm shows how each action head turns one camera frame into a chunk of moves.

**This is a composer, not a running robot model.** There is no GPU or WebGPU inference, no checkpoint is loaded, and no policy server is called. The arm animation is a hand-written schematic, labelled SIMULATION.

## What it does

- **First load is already resolved:** Qwen3-VL 4B + GR00T + multimodal co-training (Bridge+Fractal) + SimplerEnv WidowX, status `official_checkpoint_and_score`, repo `StarVLA/Qwen3VL-GR00T-Bridge-RT-1`, average 65.3 from both the SimplerEnv eval page and the model zoo.
- **Five honest statuses:** official checkpoint and score, checkpoint only, score only, framework supported with no official release, not supported or planned. Caveats explain FAST Action-token models, RL via RLinf, RoboCasa-GR1 vs RoboCasa365, and recipes the sources do not state.
- **Disagreements stay visible:** Qwen3-VL OFT on WidowX shows both 42.7 (model zoo) and 64.6 (SimplerEnv eval page, 65K steps). No reconciliation is invented.
- **Schematic per head:** FAST emits tokens then decodes; OFT emits the whole chunk at once; PI denoises a noisy trajectory; GR00T shows a System 2 plan beat, then a System 1 chunk.
- **Live Hub lookup:** `/api/hub` calls the public Hugging Face API (`/api/models/StarVLA/{repo}` and `/api/models?author=StarVLA`) with an 8 s timeout, one attempt, and a per-IP cooldown. Only the 45 vendored official ids can be looked up. If the Hub fails, the vendored 2026-11-24 catalog stays on screen with a visible "Live lookup unavailable" state. A "Simulate Hub offline" toggle exercises that path on purpose.

All numbers and ids are vendored in `src/lib/data.ts` from `PLAN.md` (fetched 2026-11-24).

## Run

```bash
bun install
bun run dev      # http://localhost:3000
bun test         # resolver, score lookup, Hub parsing, simulation state
bun run lint
bun run typecheck
bun run build
```

No environment variables or secrets are required (`.env.example` says so). For Vercel, set Root Directory to `apps/starvla-composer`.

## Attribution

- StarVLA: https://github.com/starVLA/starVLA, site https://starvla.github.io/, Hugging Face org https://huggingface.co/StarVLA
- License: the StarVLA `LICENSE` is MIT (copyright StarVLA Team) with two extra clauses about descriptive rebase messages and keeping the two latest upstream commits separate; GitHub reports it as Other / NOASSERTION. https://github.com/starVLA/starVLA/blob/starVLA/LICENSE
- Branches used: stable `starVLA` at `3422b9f2387b6f682cf02802904a77b23ab13afd`, dev `starVLA_dev` at `99764f57339d2d5e1e74f075d32066c5edac78ef`
- Technical report: arXiv 2604.05014. Related: StarVLA-alpha arXiv 2604.11757, VLAct arXiv 2608.27550
- GitHub API on 2026-11-24: 3975 stars, 525 forks. Hugging Face API on 2026-11-24: 45 official model repos
- Bookmark: https://x.com/JinhuiYe/status/2122753570730893678

This demo copies no StarVLA code or weights; it only links to and quotes published numbers.
