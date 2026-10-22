// Speed and latency math for one streamed run, measured in the browser.

export type RunTimes = {
  startMs: number;
  firstTokenMs: number | null;
  endMs: number;
  // Provider-reported completion tokens (usage). Null when absent.
  usageTokens: number | null;
  // Text received, used for the estimate when usage is missing.
  text: string;
};

export type RunMetrics = {
  ttftMs: number | null;
  totalMs: number;
  tokens: number;
  tokensEstimated: boolean;
  tokensPerSec: number | null;
};

// Rough fallback: about 4 characters per token for English text.
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.round(text.length / 4));
}

export function ttft(startMs: number, firstTokenMs: number | null): number | null {
  if (firstTokenMs === null) return null;
  return Math.max(0, firstTokenMs - startMs);
}

// Decode tokens/s: completion tokens divided by the time after the first token.
export function tokensPerSecond(tokens: number, firstTokenMs: number | null, endMs: number): number | null {
  if (firstTokenMs === null || tokens <= 0) return null;
  const secs = (endMs - firstTokenMs) / 1000;
  if (secs <= 0) return null;
  return tokens / secs;
}

export function computeRunMetrics(t: RunTimes): RunMetrics {
  const tokensEstimated = t.usageTokens === null;
  const tokens = t.usageTokens ?? estimateTokens(t.text);
  return {
    ttftMs: ttft(t.startMs, t.firstTokenMs),
    totalMs: Math.max(0, t.endMs - t.startMs),
    tokens,
    tokensEstimated,
    tokensPerSec: tokensPerSecond(tokens, t.firstTokenMs, t.endMs),
  };
}

// Instantaneous rate over a trailing window of (timestamp, tokenCount) marks.
export function windowRate(marks: { t: number; n: number }[], now: number, windowMs = 1000): number {
  const from = now - windowMs;
  let n = 0;
  for (const m of marks) if (m.t > from && m.t <= now) n += m.n;
  return n / (windowMs / 1000);
}
