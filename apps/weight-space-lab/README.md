# Weight-Space Lab

A dark, single-page engineering lab for one fact: an LLM agent edited **two tensors** of Qwen3.5-0.8B, with no gradients and no training, and the model stopped looping on math.

- **Compare**: base `Qwen/Qwen3.5-0.8B` and the edited `akhaliq/Qwen3.5-0.8B-weight-space-programming` side by side on 20 real paired MATH-500 recordings, with recorded-text playback, find-in-answer, exact repeated-line highlighting and output-shape indicators. A best-effort **live** compare goes through a server proxy to a public third-party Hugging Face Space and falls back clearly when its GPU quota refuses the call.
- **The edit**: heatmaps of the real edited bfloat16 values in `layers.15.mlp.down_proj.weight` and `layers.19.mlp.down_proj.weight` (1024 x 3584, 64 changed columns each). Click a column to see every changed row with its flat index, raw uint16 bits, sign/exponent/mantissa and the decoded value.
- **Experiment**: the authors' scores for every benchmark at 0, 10, 25 and 50 forward-pass budgets, plus a scrubbable replay of the p10c, p25c and p50c agent diaries with their final notes.
- **Sources**: author results and the independent Hugging Face re-run in separate tables, the shared eval protocol, scope limits and every source link.

## Run

```bash
bun install
bun run dev        # http://localhost:3000
bun test           # decoding, indexing, counts, repetition, live guards
bun run lint && bun run typecheck && bun run build
```

No secrets are needed. `HF_TOKEN` (see `.env.example`) is optional and only forwarded server-side to the Space.

## Data provenance

Everything the UI shows comes from files checked into `public/data/`, fetched on demand (each recording loads only when selected):

| File | Origin |
|---|---|
| `weight-edit.json` | Exact sparse diff from [`exp8_math/runs/p50c/edit/edit.npz`](https://raw.githubusercontent.com/RikiyaT/lm_understand-logs/main/exp8_math/runs/p50c/edit/edit.npz) plus its [`manifest.json`](https://raw.githubusercontent.com/RikiyaT/lm_understand-logs/main/exp8_math/runs/p50c/edit/manifest.json), repo [RikiyaT/lm_understand-logs](https://github.com/RikiyaT/lm_understand-logs) (CC BY 4.0 / MIT) |
| `author-benchmarks.json` | [benchmarks.json](https://rikiyat.github.io/blog/weight-space-programming/assets/mathedit/benchmarks.json) from the blog post |
| `author-trajectories.json` | [trajectories.json](https://rikiyat.github.io/blog/weight-space-programming/assets/mathedit/trajectories.json) from the blog post |
| `recordings/*.json` | 20 paired outputs from the re-run's [`eval/`](https://huggingface.co/akhaliq/Qwen3.5-0.8B-weight-space-programming/tree/main/eval) samples, verbatim |

How the numbers are read:

- `idx` is a flat row-major index (`row = idx / 3584`, `col = idx % 3584`); `val` is the edited value as uint16 bfloat16 bits, decoded as the float32 with bits `val << 16`. Base weights are not in the diff and are never shown or guessed.
- **130,188** changed bfloat16 entries (65,260 + 64,928) are the idx/val pairs. **131,072** is the authors' touched-slot count (64 columns x 1024 rows x 2 layers). The 884 missing slots rounded back to their original bits, so the manifest does not count them; the heatmap hatches them.
- The staged manifest's `max_abs_edited_weight` (about 6.8e-41) matches reading the uint16 bits as float32 without the 16-bit shift, so the UI does not display it and computes max |w| from decoded values instead.
- Two edited outputs (`prealgebra-1622`, `precalculus-927`) end in millions of trailing whitespace characters. The UI trims trailing whitespace for display and states both lengths. Wording is untouched.
- Repetition highlighting marks lines of 40+ characters that exactly repeat an earlier line. `</think>` and `\boxed{}` indicators describe text shape only. None of these is a grade.
- Author-reported p50c account: 158 turns, 80 Python runs, 50 forward passes, 3 handoffs. The JSON gives 158 turns, 80 Python turns that ran (6 more were not run) and 50 passes used; handoffs are not a JSON field.

Results are never mixed:

- **Author (blog, Experiment 8)**: MATH-500 7.9 to 48.1, GSM8K 13.8 to 67.1, IFEval 21.0 to 62.3, MATH-500 hit token limit 93.0 to 33.1.
- **Independent re-run ([model card](https://huggingface.co/akhaliq/Qwen3.5-0.8B-weight-space-programming), 2026-11-02)**: edited MATH-500 51.0%, 31.6% cut at 32k, full 500 x 4 = 2,000 generations, 43.4M tokens, 51 min on one H200; base 5.0%, 95% cut on a 25-problem smoke test.

## Live mode

`POST /api/live` calls [`ML-Intern-lab/weight-space-programming-demo`](https://huggingface.co/spaces/ML-Intern-lab/weight-space-programming-demo) endpoint `/compare_safe(problem, max_new_tokens)` with `@gradio/client` on the Node runtime (`maxDuration` 300). Guards: 1,500-char problem cap, tokens clamped to 1024..2048, one call per IP per minute, two calls in flight at most, a 280 s timeout and no retry. The Space reports its ZeroGPU quota error as normal output text; the proxy recognises it and returns `status: "unavailable"`, which the UI shows as such while the panes stay labelled RECORDED. As tested on 2026-11-06, anonymous calls are refused because the Space requests 450 s of GPU. This app runs no model weights itself.

## Sources

- Bookmark: https://x.com/rikiyatakehi/status/2117313742891327994
- Blog: https://rikiyat.github.io/blog/weight-space-programming/
- Logs and diff: https://github.com/RikiyaT/lm_understand-logs (`exp8_math/runs/p50c/edit`)
- Edited checkpoint and eval samples: https://huggingface.co/akhaliq/Qwen3.5-0.8B-weight-space-programming (Apache-2.0)
- Author model page: https://huggingface.co/RikiyaT/Qwen3.5-0.8B-weight-space-programming
- Base model: https://huggingface.co/Qwen/Qwen3.5-0.8B
- Space: https://huggingface.co/spaces/ML-Intern-lab/weight-space-programming-demo ([app.py](https://huggingface.co/spaces/ML-Intern-lab/weight-space-programming-demo/blob/main/app.py))

## Stack

Bun, Next.js 16 App Router, React 19, TypeScript, Tailwind v4, shadcn/ui (base-nova), `@gradio/client` server-only. Charts and heatmaps are hand-rolled SVG and canvas.
