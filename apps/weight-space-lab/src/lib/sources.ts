// Every published number shown outside the checked-in JSON lives here, with its source.

export const SRC = {
  bookmark: "https://x.com/rikiyatakehi/status/2117313742891327994",
  blog: "https://rikiyat.github.io/blog/weight-space-programming/",
  benchmarksJson: "https://rikiyat.github.io/blog/weight-space-programming/assets/mathedit/benchmarks.json",
  trajectoriesJson: "https://rikiyat.github.io/blog/weight-space-programming/assets/mathedit/trajectories.json",
  logsRepo: "https://github.com/RikiyaT/lm_understand-logs",
  editDir: "https://github.com/RikiyaT/lm_understand-logs/tree/main/exp8_math/runs/p50c/edit",
  editNpz: "https://raw.githubusercontent.com/RikiyaT/lm_understand-logs/main/exp8_math/runs/p50c/edit/edit.npz",
  editManifest: "https://raw.githubusercontent.com/RikiyaT/lm_understand-logs/main/exp8_math/runs/p50c/edit/manifest.json",
  modelCard: "https://huggingface.co/akhaliq/Qwen3.5-0.8B-weight-space-programming",
  authorModel: "https://huggingface.co/RikiyaT/Qwen3.5-0.8B-weight-space-programming",
  evalDir: "https://huggingface.co/akhaliq/Qwen3.5-0.8B-weight-space-programming/tree/main/eval",
  baseModel: "https://huggingface.co/Qwen/Qwen3.5-0.8B",
  space: "https://huggingface.co/spaces/ML-Intern-lab/weight-space-programming-demo",
  spaceSource: "https://huggingface.co/spaces/ML-Intern-lab/weight-space-programming-demo/blob/main/app.py",
  math500: "https://huggingface.co/datasets/HuggingFaceH4/MATH-500",
} as const;

export const BASE_MODEL = "Qwen/Qwen3.5-0.8B";
export const EDITED_MODEL = "akhaliq/Qwen3.5-0.8B-weight-space-programming";
export const BASE_REVISION = "2fc06364715b967f1860aea9cf38778875588b17";

export const PROMPT_SUFFIX = "Please reason step by step, and put your final answer within \\boxed{}.";

export const EVAL_SETTINGS = [
  ["engine", "vLLM"],
  ["thinking", "on"],
  ["temperature", "0.6"],
  ["top_p", "0.95"],
  ["top_k", "20"],
  ["presence_penalty", "1.5"],
  ["max new tokens", "32,768"],
  ["seed", "0"],
  ["grading", "last \\boxed{}, math-verify 0.9.0"],
] as const;

/** Author-reported, blog post Experiment 8 (0 vs 50 forward passes). */
export const AUTHOR_RESULTS = [
  { metric: "MATH-500 accuracy", base: "7.9%", edited: "48.1%" },
  { metric: "GSM8K accuracy", base: "13.8%", edited: "67.1%" },
  { metric: "IFEval", base: "21.0%", edited: "62.3%" },
  { metric: "MATH-500 hit token limit", base: "93.0%", edited: "33.1%" },
] as const;

/** Independent re-run, akhaliq model card, 2026-11-02. Different run counts: never merge with the author table. */
export const RERUN_RESULTS = [
  { model: "Base Qwen3.5-0.8B", accuracy: "5.0%", cut: "95%", scope: "25-problem smoke test" },
  { model: "Edited checkpoint", accuracy: "51.0%", cut: "31.6%", scope: "full MATH-500, 500 problems x 4 samples = 2,000 generations" },
] as const;

export const RERUN_COMPUTE = "51 minutes on one NVIDIA H200, 2,000 generations, 43.4M generated tokens (vLLM 0.33.0, transformers 5.20.2, math-verify 0.9.0)";

export const AUTHOR_ACCOUNT_P50C = { turns: 158, pythonRuns: 80, forwardPasses: 50, handoffs: 3 } as const;

export const SPACE_SAMPLING = "temperature 0.6, top_p 0.95, top_k 20, thinking on, max_new_tokens slider 1024 to 8192";
