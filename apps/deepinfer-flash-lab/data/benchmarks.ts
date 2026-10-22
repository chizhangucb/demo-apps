// Every published number shown in the lab, each with the page it came from.
// Chart readings are approximate (read off the published PNG) and flagged.

export const SOURCES = {
  readme: { label: "README", url: "https://github.com/deepseek-ai/DeepInfer/blob/main/README.md" },
  qa: { label: "Q&A doc", url: "https://github.com/deepseek-ai/DeepInfer/blob/main/doc/inference_deployment_qa.md" },
  eval: { label: "eval README", url: "https://github.com/deepseek-ai/DeepInfer/blob/main/eval/README.md" },
  decodeChart: { label: "decode chart", url: "https://github.com/deepseek-ai/DeepInfer/blob/main/doc/images/decode_pareto.png" },
  prefillChart: { label: "prefill chart", url: "https://github.com/deepseek-ai/DeepInfer/blob/main/doc/images/prefill_pareto.png" },
  pricing: { label: "pricing", url: "https://api-docs.deepseek.com/quick_start/pricing" },
  api: { label: "API docs", url: "https://api-docs.deepseek.com/" },
  jsonMode: { label: "JSON mode", url: "https://api-docs.deepseek.com/guides/json_mode" },
  bookmark: { label: "announcement", url: "https://x.com/deepseek_ai/status/2112476496283775135" },
  repo: { label: "DeepInfer repo", url: "https://github.com/deepseek-ai/DeepInfer" },
  structuredExample: {
    label: "structured output example",
    url: "https://github.com/deepseek-ai/DeepInfer/blob/main/examples/_structured_output.py",
  },
} as const;

export type SourceKey = keyof typeof SOURCES;

export const ORIGINAL_CHART_IMAGES = {
  decode: "https://raw.githubusercontent.com/deepseek-ai/DeepInfer/main/doc/images/decode_pareto.png",
  prefill: "https://raw.githubusercontent.com/deepseek-ai/DeepInfer/main/doc/images/prefill_pareto.png",
};

export type DecodePoint = { reqs: number; tokPerSecPerUser: number; tokPerSecPerGpu: number; approx: true; source: string };
export type PrefillPoint = { batchTokens: number; latencyMs: number; tokPerSecPerGpu: number; approx: true; source: string };

export const DECODE_SUBTITLE = "EP64DP64 | 384+64 experts | context 131,072 | nextn=3 fixed | per-token acceptance 75% -> tau=3.25";
export const PREFILL_SUBTITLE = "EP4DP4 | 384+32 experts | context 131,072 | Decoder Bounded Replay (140 tokens)";
export const BENCH_NOTE = "Measured on 4 SM100 GPUs for prefill and 64 for decode, each within one scale-up domain.";

const dc = SOURCES.decodeChart.url;
export const DECODE_POINTS: DecodePoint[] = [
  { reqs: 8, tokPerSecPerUser: 325, tokPerSecPerGpu: 2600, approx: true, source: dc },
  { reqs: 16, tokPerSecPerUser: 315, tokPerSecPerGpu: 5000, approx: true, source: dc },
  { reqs: 32, tokPerSecPerUser: 297, tokPerSecPerGpu: 9500, approx: true, source: dc },
  { reqs: 64, tokPerSecPerUser: 246, tokPerSecPerGpu: 15700, approx: true, source: dc },
  { reqs: 128, tokPerSecPerUser: 178, tokPerSecPerGpu: 22800, approx: true, source: dc },
  { reqs: 256, tokPerSecPerUser: 103, tokPerSecPerGpu: 26300, approx: true, source: dc },
];

const pc = SOURCES.prefillChart.url;
export const PREFILL_POINTS: PrefillPoint[] = [
  { batchTokens: 4096, latencyMs: 68, tokPerSecPerGpu: 60000, approx: true, source: pc },
  { batchTokens: 8192, latencyMs: 114, tokPerSecPerGpu: 71500, approx: true, source: pc },
  { batchTokens: 16384, latencyMs: 200, tokPerSecPerGpu: 81700, approx: true, source: pc },
  { batchTokens: 32768, latencyMs: 376, tokPerSecPerGpu: 87000, approx: true, source: pc },
  { batchTokens: 65536, latencyMs: 731, tokPerSecPerGpu: 89500, approx: true, source: pc },
];

export type VerifyRow = {
  concurrency: number;
  fixedVerified: number;
  dynamicVerified: number;
  fixedAccepted: number;
  dynamicAccepted: number;
  fixedTokPerSec: number;
  dynamicTokPerSec: number;
  gain: string;
  source: string;
};

const qa = SOURCES.qa.url;
export const VERIFY_TABLE: VerifyRow[] = [
  { concurrency: 16, fixedVerified: 5, dynamicVerified: 4.44, fixedAccepted: 3.32, dynamicAccepted: 3.24, fixedTokPerSec: 4891, dynamicTokPerSec: 4816, gain: "-1.5%", source: qa },
  { concurrency: 32, fixedVerified: 5, dynamicVerified: 3.65, fixedAccepted: 3.25, dynamicAccepted: 3.17, fixedTokPerSec: 8964, dynamicTokPerSec: 9111, gain: "+1.6%", source: qa },
  { concurrency: 48, fixedVerified: 5, dynamicVerified: 3.94, fixedAccepted: 3.3, dynamicAccepted: 3.26, fixedTokPerSec: 12032, dynamicTokPerSec: 12467, gain: "+3.6%", source: qa },
  { concurrency: 60, fixedVerified: 5, dynamicVerified: 3.58, fixedAccepted: 3.3, dynamicAccepted: 3.21, fixedTokPerSec: 13730, dynamicTokPerSec: 14466, gain: "+5.4%", source: qa },
  { concurrency: 72, fixedVerified: 5, dynamicVerified: 3.24, fixedAccepted: 3.29, dynamicAccepted: 3.12, fixedTokPerSec: 14962, dynamicTokPerSec: 15961, gain: "+6.7%", source: qa },
  { concurrency: 96, fixedVerified: 5, dynamicVerified: 3.24, fixedAccepted: 3.3, dynamicAccepted: 3.15, fixedTokPerSec: 16817, dynamicTokPerSec: 18660, gain: "+11.0%", source: qa },
];

export type Fact = { label: string; value: string; detail?: string; source: string };

export const HEADLINE_FACTS: Fact[] = [
  { label: "Tokens served per day", value: "155T", detail: "a single cluster", source: qa },
  { label: "Revenue per GPU-hour", value: "US$38", detail: "at valley pricing", source: qa },
  { label: "Draft tokens per step", value: "5", detail: "production draft model", source: qa },
  { label: "Draft tokens verified per step", value: "about 30% fewer", detail: "5.00 to 3.2 to 4.4, dynamic vs fixed-5", source: qa },
  { label: "Accepted length", value: "3.29 vs 3.20", detail: "fixed vs dynamic, about the same", source: qa },
  { label: "Throughput gain", value: "+4 to 7%", detail: "at about 60 seqs per rank", source: qa },
  { label: "SWA bounded replay", value: "140 tokens", detail: "default V4.1 setting", source: SOURCES.readme.url },
  { label: "Max draft length", value: "5", detail: "DEEPINFER_USE_NEXTN_DECODE default", source: SOURCES.readme.url },
];

export const EVAL_RESULTS: Fact[] = [
  { label: "AIME 2026", value: "99.9%", source: SOURCES.eval.url },
  { label: "GPQA Diamond", value: "93.4%", source: SOURCES.eval.url },
  { label: "HLE-Full", value: "42.6%", source: SOURCES.eval.url },
];

export const PRICING: Fact[] = [
  { label: "Input, cache miss", value: "$0.15 / $0.3", detail: "per 1M tokens, off-peak / peak", source: SOURCES.pricing.url },
  { label: "Output", value: "$0.6 / $1.2", detail: "per 1M tokens, off-peak / peak", source: SOURCES.pricing.url },
  { label: "Context", value: "1M", detail: "max output 384K", source: SOURCES.pricing.url },
];

export type Feature = { name: string; line: string; status: "shown here" | "simulated here" | "upstream only"; note?: string; source: string };

const rd = SOURCES.readme.url;
export const FEATURES: Feature[] = [
  { name: "Optimized kernels", line: "FlashMLA, DeepGEMM, DeepEP, TileKernels, DeepSelect and custom TileLang kernels.", status: "upstream only", source: rd },
  { name: "Parallelism", line: "Attention DP or balanced CP, MoE expert parallel with EPLB.", status: "upstream only", source: rd },
  { name: "DSpark decoding", line: "Draft tokens plus confidence estimates that schedule verification.", status: "simulated here", note: "CH.03", source: rd },
  { name: "SWA bounded replay", line: "Replay only a bounded suffix (140 tokens) in decoder prefill.", status: "upstream only", note: "in the prefill chart", source: rd },
  { name: "Async scheduling", line: "Overlap CPU batch scheduling with device execution. On by default.", status: "simulated here", note: "CH.03", source: rd },
  { name: "Batch-invariant inference", line: "Same output regardless of batch composition.", status: "upstream only", note: "NVIDIA only", source: rd },
  { name: "Deterministic sampling", line: "Reproducible sampling across runs.", status: "upstream only", note: "NVIDIA only", source: rd },
  { name: "Structured outputs", line: "Regex, JSON schema or EBNF grammar via so_args.", status: "shown here", note: "JSON schema only; regex and EBNF upstream only", source: rd },
];
