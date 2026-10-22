# DeepInfer Flash Lab

A single-user lab for DeepSeek-V4.1-Flash, built around [DeepInfer](https://github.com/deepseek-ai/DeepInfer), DeepSeek's open-source production inference framework (Apache-2.0, DeepSeek-AI). DeepInfer needs NVIDIA SM100 GPUs or Huawei Ascend 950 NPUs, so it cannot run on Vercel. This lab shows its features from the outside: it talks to the hosted DeepSeek API, which serves the same DeepSeek-V4.1-Flash-1017 checkpoint DeepInfer loads by default.

Bookmark: https://x.com/deepseek_ai/status/2112476496283775135. Plan: [`PLAN.md`](./PLAN.md).

## What is on the page

| Channel | What it is | Status |
| --- | --- | --- |
| CH.01 Speed and latency | Radial tokens/s gauge, TTFT, decode tokens/s, total latency, token count, sparkline, run log (last 10, localStorage) | LIVE: measured in the browser from the real stream. SAMPLE: replay of recorded timings |
| CH.02 Streaming playground | 4 presets, prompt box, thinking toggle, streamed reasoning and answer | LIVE or SAMPLE |
| CH.03 Structured output | JSON schema editor with presets (DeepInfer's own color/count example, bug report, recipe), returned JSON, Ajv validation per field | LIVE or SAMPLE |
| CH.04 DSpark decode step | Draft tokens with confidence bars, sort, prefix selection, verification; slider over the published fixed-5 vs dynamic table | SIMULATION (published table is real, with source links) |
| CH.05 Batch scheduler | CPU and GPU lanes, sync vs async (zero-overhead) ordering from the Q&A doc | SIMULATION, illustrative durations |
| CH.06 Published benchmarks | Interactive decode and prefill Pareto redraws (approx., read from chart), original PNGs behind a toggle, verification table, at-scale figures, eval Pass@1, API pricing | Published numbers, each with a source link |
| CH.07 / CH.08 | Feature map (shown here, simulated here, upstream only) and hardware note | |

### LIVE, SAMPLE, SIMULATION

- **LIVE**: a key is set. `/api/chat` streams from the provider with `max_tokens` 800, a 20 s first-byte timeout and a 60 s total timeout. `/api/structured` uses JSON mode (DeepSeek `response_format: {"type": "json_object"}` with the schema and an example in the prompt; OpenRouter `json_schema`), 30 s timeout, then validates with Ajv. If a live call fails before any token arrives, the route falls back to the matching sample and says so.
- **SAMPLE**: no key. Every preset answer and structured output was recorded from DeepSeek-V4.1-Flash via OpenRouter on Oct 22, 2026 (model id `deepseek/deepseek-v4.1-flash`) by `bun run samples` (`scripts/build-samples.ts`, needs `OPENROUTER_API_KEY`). Each chat preset was recorded twice, thinking off and thinking on. `data/samples/chat.json` keeps the streamed text exactly as it arrived plus the measured time to first token and the measured gap before each chunk; `data/samples/structured.json` keeps the raw JSON and the measured round trip. The server replays a run at its recorded pace and the browser measures the replay with the same code as LIVE. The model output is verbatim, so it can contain punctuation such as dashes that the app copy itself avoids. Everything is labelled SAMPLE.
- **SIMULATION**: CH.04 and CH.05 are animations. Confidences, acceptance draws, the cost model and block lengths are made up for illustration; only the numbers carrying a source link are published figures.

## Run

```bash
bun install
bun run dev        # http://localhost:3000
bun test           # SSE parser, TTFT and tokens/s math, schema pass/fail, mode resolution, benchmark sources
bun run lint
bun run typecheck
```

### Environment (all optional)

Copy `.env.example` to `.env.local`.

| Variable | Use |
| --- | --- |
| `DEEPSEEK_API_KEY` | Primary. `https://api.deepseek.com/chat/completions`, model `deepseek-flash` |
| `OPENROUTER_API_KEY` | Fallback when no DeepSeek key. `https://openrouter.ai/api/v1/chat/completions`, model `deepseek/deepseek-v4.1-flash` |
| `DEEPSEEK_MODEL`, `OPENROUTER_MODEL` | Model id overrides |

Keys are read only on the server. `/api/mode` returns the mode, provider and model id, never the key. With no keys the whole page works in SAMPLE mode. On Vercel, set Root Directory to `apps/deepinfer-flash-lab`.

## Layout

- `src/lib/sse.ts` SSE parser and OpenAI-format chunk mapping
- `src/lib/metrics.ts` TTFT, decode tokens/s, token estimate, rolling rate
- `src/lib/mode.ts` mode resolution
- `src/lib/validate.ts` Ajv validation with per-field results
- `src/server/provider.ts` DeepSeek and OpenRouter clients, caps, timeouts, sample replay and fallback
- `src/app/api/{chat,structured,mode}` routes
- `src/components/lab/` the UI
- `data/benchmarks.ts` every published number with its source URL
- `data/samples/` preset prompts and schemas (`prompts.ts`), recorded responses and timings (`chat.json`, `structured.json`), joined in `presets.ts`

## Credits and license

- [deepseek-ai/DeepInfer](https://github.com/deepseek-ai/DeepInfer) by DeepSeek-AI, Apache License 2.0. Feature list, benchmark figures, chart subtitles and the structured output example schema come from its [README](https://github.com/deepseek-ai/DeepInfer/blob/main/README.md), [deployment Q&A](https://github.com/deepseek-ai/DeepInfer/blob/main/doc/inference_deployment_qa.md) and [eval README](https://github.com/deepseek-ai/DeepInfer/blob/main/eval/README.md).
- The original chart images ([decode](https://github.com/deepseek-ai/DeepInfer/blob/main/doc/images/decode_pareto.png), [prefill](https://github.com/deepseek-ai/DeepInfer/blob/main/doc/images/prefill_pareto.png)) are loaded from the upstream repository under Apache-2.0; nothing is copied into this repo. The interactive redraws use approximate readings and say so.
- API behavior and pricing: [DeepSeek API docs](https://api-docs.deepseek.com/).
- Announcement: https://x.com/deepseek_ai/status/2112476496283775135.
