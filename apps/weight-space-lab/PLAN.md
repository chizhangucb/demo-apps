# Weight-Space Lab: PLAN

## Goal

Build `apps/weight-space-lab/`, a single-user Next.js + Bun app in this repository, deployed to Vercel production. It lets one visitor compare the original Qwen3.5-0.8B with its weight-edited version, and inspect the actual weights and experiment diary behind the difference.

The demo is about a simple, visible fact: only two tensors changed. No gradients, no training job, no embeddings or output head edits. A visitor can see both generations for the same math problem, then see exactly which columns and values changed in layers 15 and 19.

Source: bookmark https://x.com/rikiyatakehi/status/2117313742891327994 and paper/blog https://rikiyat.github.io/blog/weight-space-programming/.

## MVP and acceptance criteria

1. **Side-by-side working lab.** The default first load has a real recorded comparison from the verification run. Pick any of 20 problems. Both full model outputs are available, with model names, token counts if calculated, generation source, and gold answer labelled. Base output in the left pane, edited output in the right. Show repetition by using visually distinct paragraphs or detected repeated fragments, but do not invent a score or diagnosis. Defaults to problems where the base loops and the edited one gives a final boxed answer.
2. **Real weight diff.** Two heatmaps, one per edited tensor. Their data comes from the actual public sparse edit, not synthetic values. Make layer 15 and 19 clear. Each has shape 1024 x 3584 and 64 changed columns. Show column positions, number of changed entries, relative tensor change and checksums in expandable source details. Clicking a column shows its real changed rows, raw bfloat16 bit patterns and decoded float values from the sparse edit. Link to the original `edit.npz` and `manifest.json`.
3. **Real run visualization.** A chart of MATH-500 against edit budgets 0, 10, 25 and 50 forward passes: 7.9%, 12.3%, 14.1%, 48.1%. Other author benchmarks are selectable: GSM8K, AMC23, Minerva Math, OlympiadBench, MMLU-Pro, GPQA Diamond, IFEval. An adjacent scrubber follows the p50c 50-pass run turn by turn: hypothesis text, forward-pass counts, run_events if present. Authors' own account: 158 turns, 80 Python runs, 50 forward passes, 3 handoffs. Include all three p10c, p25c, p50c runs in the diary UI, with their final notes.
4. **Results and source clarity.** Author result table: MATH-500 7.9 -> 48.1, GSM8K 13.8 -> 67.1, IFEval 21.0 -> 62.3, hit-token-limit 93.0 -> 33.1. Independent Hugging Face re-run table: edited MATH-500 51.0% and truncated 31.6%, base 5.0% and truncated 95% on a 25-problem smoke test. These numbers from different settings/run counts must never be mixed.
5. **Best-effort Live mode.** User can type a problem and request a live comparison through the researchers' public Hugging Face Space. Use Streaming output if supported; otherwise request/response is fine. Always show when a run is pending, which endpoint is used and when the response is from Records rather than Live. On quota, network or rate-limit failure, clearly tell the user live generation is unavailable and let them switch to recordings. Do not pretend recordings are live and never silently substitute another Qwen model.
6. **Provenance and limits.** Blog, model card, Space, eval samples, dataset, logs, and source links in a source panel. Plainly state independent rerun used 51 minutes on an H200, 2,000 generations and 43.4M generated tokens; live GPU in Vercel is not possible. Also state that fixing loops is not the same as learning math, in the authors' words paraphrased without quotes.

## MVP outs

- Running model weights on a GPU owned by this app.
- Fine-tuning, training, applying arbitrary weight edits or exposing a model editor.
- Per-user uploads, inference credits, or billing.
- New benchmark accuracy measurements on our own model eval.

## Stack

- Next.js App Router, React and TypeScript, matching sibling apps. `bun install`, `bun run dev`, `bun run build`.
- shadcn/ui for panes, controls and detail panels. CSS/SVG for heatmaps and trajectory charts; no heavyweight chart framework needed.
- Server-side route(s) for the best-effort Gradio call and optional token; no API key required for normal interactive demo.
- All recorded evidence in `public/data/`, fetched by path on demand.

## Tasks

### 1. Ship source data and types

Use the real files already staged in `apps/weight-space-lab/public/data/`:

- `weight-edit.json`: exact sparse diff from https://raw.githubusercontent.com/RikiyaT/lm_understand-logs/main/exp8_math/runs/p50c/edit/edit.npz, plus its public manifest. `idx` arrays give flat row-major indices. `val` arrays give uint16 bfloat16 edited bits. Decode as float32 bits `(uint16 << 16)`, preserving the original weight values. Each two-element display row must be labeled as raw bits and its decoded value. This provides no unedited weights; do not invent them.
- `author-benchmarks.json`: exact blog data https://rikiyat.github.io/blog/weight-space-programming/assets/mathedit/benchmarks.json.
- `author-trajectories.json`: exact blog data https://rikiyat.github.io/blog/weight-space-programming/assets/mathedit/trajectories.json.
- `recordings/index.json`: one row per paired sample. Use id, problem, subject, level, gold_answer, base_chars, edited_chars, file. Load each specific `recordings/<file>` on selection. `base` and `edited` are model outputs, verbatim from https://huggingface.co/akhaliq/Qwen3.5-0.8B-weight-space-programming/tree/main/eval except two output strings in the source end with long whitespace padding. If useful, trim only trailing whitespace, not reasoning or wording.

Preserve all actual source data and generated-model wording. Display long content with independent scrolls and find-in-answer if simple. No invented limitation counts or token counts: if calculating generated tokens, use tokenizer-estimated or omit.

### 2. Comparison UI

Single desktop and mobile-friendly page with tabs or views: "Compare", "The edit", "Experiment". Design priority: both models visible from first load. Pair dropdown from `recordings/index.json`, show current problem, source, gold answer and per-model character counts. Add a "Play generation" to progressively reveal chunks of base and edited output for observation, with a Stop control. This is an explicit playback of recorded text, never called Live.

For base, detect long repeated adjacent fragments when trivial to implement (e.g. exact consecutive 80-character repeats) and show "repetition detected" with a highlight, otherwise just plain text. Use `\boxed{...}` presence as an indicator of output shape only, not an automated math-equality judgement. Gold is the official answer; not a model score.

Live: Gradio Space host `https://ml-intern-lab-weight-space-programming-demo.hf.space`; source `https://huggingface.co/spaces/ML-Intern-lab/weight-space-programming-demo/blob/main/app.py` and endpoint `/compare_safe(problem, max_new_tokens)`. It compares `Qwen/Qwen3.5-0.8B` vs `akhaliq/Qwen3.5-0.8B-weight-space-programming`, sampling at temperature 0.6, top_p 0.95, top_k 20, thinking on, slider 1024..8192. Use `@gradio/client` if possible. Optional `HF_TOKEN` in env and `maxDuration` 300 on server route; protect cost with input length and per-IP cooldown. **Already tested 2026-11-06 UTC:** anonymous live request fails before GPU runs because this third-party Space requests 450 seconds while anonymous allowance is 2 minutes. A free account has only 5 min/day, so HF_TOKEN can also fail without PRO. Never plan around live being guaranteed. Base and edited recorded answers work without live. Recorded API is `/show_recorded(pid)`. Give the public Space a link and credit.

 Optional dedicated inference could be run with pay-as-you-go but is NOT required and not paid for in this build. Do not set up HF accounts or paid deployments. Do not claim Inference Providers support the edited model. OpenRouter was checked and does not list either 0.8B model.

### 3. Real weight explorer

Load `weight-edit.json`. Use color intensity to show changed-entry count by column only if the displayed rich per-value decoding is burdensome. Choose dense heatmap with real values, display an on-hover/click column strip and row locator. Exact first five changed columns: layer 15 [0, 2, 11, 25, 34], layer 19 [1, 5, 8, 11, 13]. Store descending `manifest` unchanged. use available data not mock. Display "130,188 changed bfloat16 entries" for actual bit changes, and separately explain the authors' 131,072 touched slots budget = 64 columns x 1024 rows x 2 layers. Manifest says entries whose values round back to identical bits aren't counted. This distinction is essential.

Tensor rows:
- `model.language_model.layers.15.mlp.down_proj.weight`, shape [1024,3584], 65,260 changed entries, 64 changed columns, relative change 0.10635984688997269, edited sha256 82e2d733ea64feaeb4af93a1e065641d3df98b494a8b7576ef2f52e90fe2ee53.
- `model.language_model.layers.19.mlp.down_proj.weight`, shape [1024,3584], 64,928 changed entries, 64 changed columns, 1023 changed rows, relative change 0.08106115460395813, edited sha256 8ef3c61bc36af113ad58e89dbb0a4a14dcba5a45cb750c15ab515c82ddd12eb2.

Avoid more idiosyncratic claims than source. Source repo CC BY 4.0 / MIT. Cite https://github.com/RikiyaT/lm_understand-logs/tree/main/exp8_math/runs/p50c/edit.

### 4. Experiment/result UI

Use trajectory JSON schema known as `runs[] { run, budget, turns[{ turn, used, kind, hypothesis, pass, used_after }], final }`. p50c has 158 turns; p25c 86; p10c 74. Display experiment details without making up fields. Traverse and progress playback can replay the diary; it is not a new live training run. Use simple compact SVG custom line for score-by-budget data requiring vertical axis labeled %. State they are author-reported thinking-on evaluations up to 32768 tokens. Standalone re-run results from model card provide independent evidence of this same edited checkpoint, separate table.

Benchmarks and results source: https://huggingface.co/RikiyaT/Qwen3.5-0.8B-weight-space-programming ( rebuilt by akhaliq on 2026-11-02) and https://rikiyat.github.io/blog/weight-space-programming/. Source has base/eval samples. Model generation instruction exact: `Please reason step by step, and put your final answer within \boxed{}.`; eval sampling: thinking on, vLLM, temp 0.6, top_p 0.95, top_k 20, presence_penalty 1.5, max 32768 tokens, seed 0, last boxed graded math-verify 0.9.0. Author checkpoint base: Qwen/Qwen3.5-0.8B @ 2fc06364715b967f1860aea9cf38778875588b17. Note the evaluated post used text-only export but this checkpoint full multimodal; language tensors hash-verified identical. Link no additional made-up reasons.

### 5. Verify/proof/documentation

Run production build and production dev/proxy route. Check all 20 samples reachable and full source strings not corrupted. Click heatmap columns, change all three budget runs, run live to see expected quota failure gracefully switches to recorded. Screenshot the actual first screen with both columns, weight heatmap and experiment graph. Run creep tests if sample full string handling grows too large. Capture at least screenshot and short video hosted off repo as AGENTS.md requires. PR includes links to hosted proof, and notes that live model runs aren't guaranteed and the app uses real recorded verification otherwise. No fake data, no verbatim user messages.

## Deferred

- A dedicated self-hosted GPU or paying for dedicated Hugging Face Inference Endpoints (scale-to-zero cold starts possible). Not needed to deliver true comparison and edit.
- Third-party model output scoring, math-verify integration, statistics beyond those published.
- Custom user weight editors, weight upload, arbitrary model comparison.

## Non-negotiables

Only build this app; never modify another app or root tracking. No new GitHub repo. bun config `[install] minimumReleaseAge = 259200` before dependency install. No secrets or payload in client beyond public datasets/models. No dash characters in outbound user messages (repo prose can use regular hyphens normally). Cite sources with links; no source quotation marks unless exact original words.
