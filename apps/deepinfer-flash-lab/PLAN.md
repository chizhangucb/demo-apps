# DeepInfer Flash Lab: PLAN

## Goal

A single-user Next.js + Bun playground on Vercel built around [DeepInfer](https://github.com/deepseek-ai/DeepInfer) (Apache-2.0, DeepSeek-AI), DeepSeek's open-source production inference framework for DeepSeek-V4.1-Flash. DeepInfer itself needs NVIDIA SM100 GPUs or Huawei Ascend 950 NPUs, so it cannot run on Vercel. The demo is a live DeepSeek-V4.1-Flash lab that shows DeepInfer's features from the outside:

1. A streaming playground against the hosted DeepSeek API (the hosted API serves the same DeepSeek-V4.1-Flash-1017 checkpoint DeepInfer loads by default).
2. A live tokens per second and latency gauge measured from the real streamed response in the browser (time to first token, decode tokens/s, total latency).
3. A structured output panel: pick or edit a JSON schema, get JSON back, validate it against the schema and show pass or fail per field.
4. An interactive explainer, labelled SIMULATION, of DSpark draft-token decoding with confidence-scheduled verification and of the asynchronous (zero-overhead) batch scheduler, driven by DeepInfer's published numbers.
5. A benchmark section with DeepInfer's published decode and prefill Pareto charts and the dynamic versus fixed-5 verification table, each number citing its source page in the UI.

A scripted no-key mode works fully with recorded sample responses, labelled SAMPLE.

Source: bookmark https://x.com/deepseek_ai/status/2112476496283775135, repo https://github.com/deepseek-ai/DeepInfer, Q&A doc https://github.com/deepseek-ai/DeepInfer/blob/main/doc/inference_deployment_qa.md, DeepSeek API docs https://api-docs.deepseek.com/.

If any link fails to load, use the Background summary below and do not search elsewhere. Do not invent features or numbers beyond what is written here.

## Background (embedded summary of the DeepInfer README, docs and the DeepSeek API docs)

Bookmark text (DeepSeek, X): "Introducing DeepInfer, our in-house inference framework, now fully open source! Powering DeepSeek-V4.1-Flash at scale with high throughput and low latency."

DeepInfer README (https://github.com/deepseek-ai/DeepInfer/blob/main/README.md):
- "The high-performance inference framework that powers DeepSeek's large-scale production services." This release provides offline inference.
- Supported model: DeepSeek-V4.1-Flash. Default checkpoint `deepseek-ai/DeepSeek-V4.1-Flash-1017` on Hugging Face.
- Supported features: optimized kernels, model and sampler runtime (FlashMLA, DeepGEMM, DeepEP, TileKernels, DeepSelect, custom TileLang kernels); parallelism (Attention DP / balanced CP, MoE EP + EPLB); DSpark and confidence-scheduled verification; SWA bounded replay; asynchronous scheduling (zero-overhead batch scheduler); batch-invariant inference; deterministic sampling; structured outputs.
- DSpark: "accelerate decoding with draft tokens and use confidence estimates to schedule verification". `DEEPINFER_USE_NEXTN_DECODE` controls the maximum draft length (default 5).
- SWA bounded replay: replay only a bounded suffix in decoder prefill; default V4.1 setting keeps 140 tokens.
- Asynchronous scheduling: overlap CPU batch scheduling with device execution; enabled by default.
- Batch-invariant inference and deterministic sampling: NVIDIA only.
- Structured outputs: constrain generation to a regex, JSON schema, or EBNF grammar via `so_args={"schema_type": ..., "schema": ...}` on `SamplingParams`. The upstream example (`examples/_structured_output.py`) uses this schema: object with `color` (enum red, green, blue) and `count` (integer enum 1, 2, 3), both required, no additional properties.
- Hardware: NVIDIA SM100 GPUs, Huawei Ascend 950 NPUs. Prereqs: Linux, GCC >= 13, Python 3.12, CUDA 13 (NVIDIA) or CANN 9.2 (Ascend).
- Not included: a KV cache system, VE/Prefill/Decode disaggregation, load balancing across data-parallel replicas.
- Benchmarks: two charts, "Measured on 4 SM100 GPUs for prefill and 64 for decode, each within one scale-up domain." Images: https://github.com/deepseek-ai/DeepInfer/blob/main/doc/images/decode_pareto.png and https://github.com/deepseek-ai/DeepInfer/blob/main/doc/images/prefill_pareto.png. Reproduce with `examples/sweep/run_sweep.sh`.
- Built primarily on vLLM, with inspiration from SGLang and TensorRT-LLM. Apache License 2.0.

Decode chart (decode_pareto.png), exact subtitle: "EP64DP64 | 384+64 experts | context 131,072 | nextn=3 fixed | per-token acceptance 75% -> tau=3.25". X axis per-user speed (tokens/s/user), Y axis output throughput (tokens/s/GPU). Point labels are decode_num_requests per DP rank. Approximate readings off the chart (label them "approx., read from chart" in the UI): 8 reqs about 325 tok/s/user and 2,600 tok/s/GPU; 16 about 315 and 5,000; 32 about 297 and 9,500; 64 about 246 and 15,700; 128 about 178 and 22,800; 256 about 103 and 26,300.

Prefill chart (prefill_pareto.png), exact subtitle: "EP4DP4 | 384+32 experts | context 131,072 | Decoder Bounded Replay (140 tokens)". X axis latency (ms per prefill step), Y axis non-cached input throughput (tokens/s/GPU). Point labels are prefill_batch_size tokens per DP rank. Approximate readings: 4,096 about 68 ms and 60,000 tok/s/GPU; 8,192 about 114 ms and 71,500; 16,384 about 200 ms and 81,700; 32,768 about 376 ms and 87,000; 65,536 about 731 ms and 89,500.

Deployment Q&A (https://github.com/deepseek-ai/DeepInfer/blob/main/doc/inference_deployment_qa.md), exact figures:
- A single cluster serves 155 trillion tokens per day, with overall revenue of US$38 per GPU-hour (at valley pricing).
- Design goals: ordinary 8-GPU machines for prefill, 64 to 128 GPU supernodes for decode, KV cache retained more than 72 hours.
- Speculative decoding (DSpark): a Confidence Head predicts each draft token's acceptance rate; in production the draft model generates 5 tokens at a time; draft tokens are sorted by expected acceptance and the prefix subset that maximizes effective throughput is verified. Dynamic-length verification cuts draft tokens verified per step by about 30% (5.00 to 3.2 to 4.4) while average accepted length stays about the same (3.29 vs 3.20), which works out to +4 to 7% throughput at the production operating point (about 60 concurrent sequences per rank), from EP64/DP64 benchmark data.
- Table (concurrency seqs/rank; fixed-5 avg verified; dynamic avg verified; fixed-5 accepted; dynamic accepted; fixed-5 est. tok/s/rank; dynamic est. tok/s/rank; gain):
  - 16; 5; 4.44; 3.32; 3.24; 4891; 4816; -1.5%
  - 32; 5; 3.65; 3.25; 3.17; 8964; 9111; +1.6%
  - 48; 5; 3.94; 3.3; 3.26; 12032; 12467; +3.6%
  - 60; 5; 3.58; 3.3; 3.21; 13730; 14466; +5.4%
  - 72; 5; 3.24; 3.29; 3.12; 14962; 15961; +6.7%
  - 96; 5; 3.24; 3.3; 3.15; 16817; 18660; +11.0%
- With async scheduling, CPU scheduling fixes only the total verify budget; per-request lengths are recomputed on the GPU by a TileLang kernel.
- Asynchronous scheduling: a decode step N is schedule(N) -> forward(N) -> sample(N) -> post-process(N); without overlap the GPU idles during post-process(N) and schedule(N+1). With overlap (following SGLang and NanoFlow), while the GPU runs forward(N) -> sample(N), the CPU runs schedule(N+1) -> launch_forward(N+1) -> post-process(N-1) -> launch_sample(N+1), leaving the GPU with no idle time.
- Structured outputs: compilation and inference are decoupled. The format constraint is compiled into a grammar automaton on a dedicated SO machine; at each decode step the automaton advances, the set of legal tokens is determined, and a mask is applied to sampling.

Eval reference results (https://github.com/deepseek-ai/DeepInfer/blob/main/eval/README.md), Pass@1 for the V4.1 model under the default configuration: AIME 2026 99.9%, GPQA Diamond 93.4%, HLE-Full 42.6% ("indicative rather than exact").

DeepSeek API (https://api-docs.deepseek.com/ and https://api-docs.deepseek.com/quick_start/pricing):
- OpenAI-format base URL `https://api.deepseek.com`, endpoint `/chat/completions`, env name `DEEPSEEK_API_KEY`.
- Model name: `deepseek-flash` (served by DeepSeek-V4.1-Flash-1017). Legacy names `deepseek-v4-flash` and `deepseek-v4-flash-vision-exp` still accepted but retired. Use `deepseek-flash`.
- Thinking mode is on by default. Toggle with `{"thinking": {"type": "enabled"}}` or `{"type": "disabled"}`; effort via `reasoning_effort` low, high or max. In thinking mode the reasoning streams in `delta.reasoning_content`, the answer in `delta.content`.
- JSON Output (https://api-docs.deepseek.com/guides/json_mode): set `response_format: {"type": "json_object"}`, include the word "json" and an example of the target shape in the prompt, set `max_tokens` sensibly; the API may occasionally return empty content. The hosted API does not take a JSON schema directly, so the app must send the schema in the prompt and validate the result server-side against the schema (for example with Ajv or Zod), showing pass or fail honestly.
- Pricing (per 1M tokens, deepseek-flash): input cache miss $0.15 off-peak, $0.3 peak; output $0.6 off-peak, $1.2 peak. Context 1M, max output 384K.

OpenRouter fallback: model id `deepseek/deepseek-v4.1-flash` on `https://openrouter.ai/api/v1/chat/completions` (from the OpenRouter models list; it lists `structured_outputs` and `response_format` as supported parameters, so on this path `response_format: {"type": "json_schema", ...}` may be sent).

## Single-user MVP

1. Mode resolution (server-side): if `DEEPSEEK_API_KEY` is set, LIVE via DeepSeek (`deepseek-flash`). Else if `OPENROUTER_API_KEY` is set, LIVE via OpenRouter (`deepseek/deepseek-v4.1-flash`). Else SAMPLE. Optional `DEEPSEEK_MODEL` and `OPENROUTER_MODEL` overrides. The UI shows a LIVE (DeepSeek), LIVE (OpenRouter) or SAMPLE badge at all times and names the provider and model id in use. Keys never reach the browser.
2. Playground: a prompt box with 3 to 4 preset prompts, a thinking on or off toggle (default off so the speed meter reflects answer tokens), a Run button, and a streaming output pane that separates reasoning text from answer text when thinking is on. Server route `/api/chat` streams from the provider (SSE) with a token cap (for example 800) and a timeout; on error it falls back to the matching recorded sample and says so.
3. Live speed and latency gauge: measured from the real stream, not from the provider. Show time to first token (ms), decode tokens per second (completion tokens divided by time after first token, using the provider's `usage` when present, otherwise a labelled estimate), total latency, and token count. Render as a large animated radial gauge plus a sparkline of tokens/s over the run. Keep a small run history (last 10 runs) in localStorage. In SAMPLE mode the gauge replays the recorded timings of the sample response and is labelled SAMPLE.
4. Structured output panel: a schema editor (JSON) with presets, including DeepInfer's own example schema (color enum, count enum, both required, no extra properties) and one richer schema (for example a bug report or a recipe). Route `/api/structured` calls the provider in JSON mode with the schema in the prompt (DeepSeek `json_object`; OpenRouter may use `json_schema`), then validates with Ajv. Show the schema, the raw JSON, and a validation result per field (green or red), plus the measured latency. Explain in one line that DeepInfer enforces the schema inside sampling with a grammar mask, while the hosted API JSON mode is validated after the fact here.
5. Decoding explainer (SIMULATION label on the panel): an animation of one decode step. The draft model proposes up to 5 tokens, each with a confidence bar; the scheduler sorts by expected acceptance and picks the prefix to verify; verified tokens are accepted or rejected. A slider for concurrency (16, 32, 48, 60, 72, 96 seqs per rank) updates a side card with the exact fixed-5 vs dynamic numbers from the Q&A table, with a source link. The confidence values in the animation are simulated and labelled as such.
6. Scheduler explainer (SIMULATION label): a two-lane timeline (CPU and GPU) animating steps N, N+1, N+2. Toggle "sync" vs "async": sync shows GPU idle gaps during post-process(N) and schedule(N+1); async shows the overlapped order from the Q&A. Durations are illustrative and labelled so; no invented speedup number.
7. Benchmarks: interactive redraws of the decode and prefill Pareto curves (hover a point to see batch size and values, labelled "approx., read from chart"), with the original PNGs available behind a "view original chart" toggle (Apache-2.0, credited), the exact chart subtitles, the "4 SM100 GPUs for prefill and 64 for decode" note, and a "measured here vs published" callout that places the user's own live tokens/s on the per-user speed axis of the decode chart with a clear caveat (hosted API over the internet, not a DeepInfer cluster). Also show the 155 trillion tokens per day and US$38 per GPU-hour figures and the eval Pass@1 table. Every number in the UI carries a small source link to its exact page (README, Q&A doc, eval README, chart image, or DeepSeek pricing page).
8. Feature map: a compact grid of the 8 README features, each card with one plain-language line and a "shown here" or "upstream only" tag (for example batch-invariant inference and deterministic sampling are upstream only, NVIDIA only).
9. Hardware note: a visible card explaining DeepInfer needs SM100 or Ascend 950 and is not running here; this page talks to the hosted DeepSeek API which serves DeepSeek-V4.1-Flash-1017.

## Acceptance criteria (look and feel; required in the first and every ticket, never deferred)

The first build and every subsequent ticket must satisfy and keep satisfying all of the following. Proof screenshots in the PR artifact must show each item:
1. A polished, distinctive dark engineering-lab look (dark instrument-panel styling, monospace numerics, grid or scanline accents, glowing gauges, sharp panels). Not a bare text page and not the usual left-controls-plus-cards layout.
2. A live tokens per second and latency gauge that animates during a stream and shows time to first token, tokens/s and total latency (SAMPLE replay counts for the no-key proof and must be labelled SAMPLE).
3. A structured output panel showing the schema, the returned JSON, and the validation result.
4. The decoding and scheduler explainer animation, visibly labelled SIMULATION.
5. The benchmark chart (decode Pareto at minimum, prefill too) with source links on every number.
6. All five render in the first build with zero secrets, and every number on screen says where it came from.

## Explicitly out of scope

Running DeepInfer itself, GPU hosting, tool calls, multi-turn chat history beyond one turn, auth, a database, vision input, the Anthropic-format endpoint, regex and EBNF modes against the hosted API (show them as "upstream only" in the feature map).

## Tasks

1. Scaffold `apps/deepinfer-flash-lab/` with Bun, Next.js App Router, TypeScript, Tailwind (shadcn as needed). `bunfig.toml` with `minimumReleaseAge = 259200` before install.
2. `lib/provider.ts`: mode resolution, DeepSeek and OpenRouter streaming clients (fetch + SSE parsing, no heavy SDK required), caps, timeouts, fallback to sample.
3. `data/samples/`: recorded sample responses for each preset prompt and each structured output preset, with recorded per-chunk timings so the gauge can replay them. Record them honestly (from a real run if a key is available during the build, otherwise hand-written and labelled "illustrative sample"). Label SAMPLE in the UI.
4. `data/benchmarks.ts`: the numbers in the Background section with a `source` URL on every entry and an `approx` flag on chart readings.
5. Routes `/api/chat` (stream), `/api/structured` (JSON + Ajv validation), `/api/mode` (which mode, provider, model id; never the key).
6. UI per the MVP and Acceptance criteria: gauge, playground, structured output panel, decoding and scheduler explainers, benchmark charts, feature map, hardware note.
7. Unit tests: SSE parser, tokens/s and TTFT math, schema validation pass and fail, mode resolution, and that every benchmark entry has a source URL.
8. README: what is live, what is SAMPLE, what is SIMULATION; attribution (upstream DeepInfer repo, Apache-2.0 license, DeepSeek-AI, the bookmark; the chart images are from the upstream repo under Apache-2.0); how to run; env vars. Commit `.env.example` with a `!.env.example` line in the app `.gitignore`.

## Screenshot proof requirements

In the PR body link a Claude artifact (hosted off-repo; commit no media) with a short video or stills showing: (1) the full lab page above the fold with the SAMPLE badge and the gauge mid-animation, (2) the structured output panel with schema, JSON and validation result, (3) the decoding explainer and the scheduler explainer with the SIMULATION label, (4) the benchmark charts with source links. Screenshots must show real content, not a blank or loading state.

## Stack and env

Bun, Next.js App Router, TypeScript, Tailwind. Vercel Root Directory `apps/deepinfer-flash-lab`. Optional env: `DEEPSEEK_API_KEY` (primary, model `deepseek-flash`), `OPENROUTER_API_KEY` (fallback, model `deepseek/deepseek-v4.1-flash`), optional `DEEPSEEK_MODEL`, `OPENROUTER_MODEL`. Zero secrets must work via the SAMPLE path.

## Build instructions for the Claude Code routine

Build only in `apps/deepinfer-flash-lab/` plus moving tracking id `2112476496283775135` (slug `deepinfer-flash-lab`) from `proposed` to `built` in `tracking/seen-bookmarks.json`. Branch `demo-deepinfer-flash-lab`, one PR to `main`. Scripted no-key SAMPLE path first and complete, then live DeepSeek and OpenRouter with fallbacks. Follow the Acceptance criteria above; do not defer the dark lab look, the gauge, the structured output panel, the explainer animation or the benchmark chart. Every benchmark number in the UI must cite its source page. Do not invent features or numbers beyond this PLAN. Do not create the Vercel project, do not edit the root README Live demos table, do not create a repo, do not touch sibling apps. Credit the upstream Apache-2.0 license in the README. No em dashes or en dashes anywhere you write (README, PR body, commits, UI copy, a generated `AGENTS.md`; replace them if a generator adds them). If a link fails, use this PLAN.
