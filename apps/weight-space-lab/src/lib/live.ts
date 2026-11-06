// Shared types and pure helpers for the best-effort live Space call.

export const SPACE_ID = "ML-Intern-lab/weight-space-programming-demo";
export const SPACE_HOST = "https://ml-intern-lab-weight-space-programming-demo.hf.space";
export const SPACE_PAGE = "https://huggingface.co/spaces/ML-Intern-lab/weight-space-programming-demo";
export const SPACE_SOURCE = "https://huggingface.co/spaces/ML-Intern-lab/weight-space-programming-demo/blob/main/app.py";
export const ENDPOINT = "/compare_safe";

export const MAX_PROBLEM_CHARS = 1500;
export const MIN_TOKENS = 1024;
/** The Space slider goes to 8192; this app caps lower to stay polite. */
export const MAX_TOKENS = 2048;
export const COOLDOWN_MS = 60_000;

export type LiveStatus = "ok" | "unavailable" | "rejected" | "error";
export type LiveResponse = {
  status: LiveStatus;
  endpoint: string;
  space: string;
  base?: string;
  edited?: string;
  message?: string;
  elapsedMs?: number;
  tokenConfigured: boolean;
  retryAfterSec?: number;
};

export function clampTokens(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : MIN_TOKENS;
  return Math.min(MAX_TOKENS, Math.max(MIN_TOKENS, v));
}

export function validateProblem(p: unknown): { ok: true; value: string } | { ok: false; message: string } {
  if (typeof p !== "string" || !p.trim()) return { ok: false, message: "Type a math problem first." };
  if (p.length > MAX_PROBLEM_CHARS) return { ok: false, message: `Problem is too long (${p.length} chars, limit ${MAX_PROBLEM_CHARS}).` };
  return { ok: true, value: p.trim() };
}

/**
 * The Space returns its own failure text as normal output when its GPU
 * allowance is exceeded. Recognise that so it is never shown as model output.
 */
export function isSpaceUnavailableText(s: string): boolean {
  return /isn't available on this Space|GPU duration|ZeroGPU|exceeded your|quota/i.test(s);
}
