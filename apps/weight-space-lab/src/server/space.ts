import "server-only";
import { Client } from "@gradio/client";
import {
  ENDPOINT,
  SPACE_ID,
  clampTokens,
  isSpaceUnavailableText,
  validateProblem,
  COOLDOWN_MS,
  type LiveResponse,
} from "@/lib/live";

const lastCall = new Map<string, number>();
let inFlight = 0;
const MAX_IN_FLIGHT = 2;
const TIMEOUT_MS = 280_000;

export function tokenConfigured(): boolean {
  return Boolean(process.env.HF_TOKEN && process.env.HF_TOKEN.startsWith("hf_"));
}

function base(): Pick<LiveResponse, "endpoint" | "space" | "tokenConfigured"> {
  return { endpoint: ENDPOINT, space: SPACE_ID, tokenConfigured: tokenConfigured() };
}

function errText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

export async function compareLive(ip: string, problemIn: unknown, tokensIn: unknown): Promise<LiveResponse> {
  const v = validateProblem(problemIn);
  if (!v.ok) return { ...base(), status: "rejected", message: v.message };
  const now = Date.now();
  const prev = lastCall.get(ip);
  if (prev && now - prev < COOLDOWN_MS) {
    const retryAfterSec = Math.ceil((COOLDOWN_MS - (now - prev)) / 1000);
    return { ...base(), status: "rejected", retryAfterSec, message: `One live call per minute. Try again in ${retryAfterSec}s, or use the recordings.` };
  }
  if (inFlight >= MAX_IN_FLIGHT) return { ...base(), status: "rejected", message: "Another live call is already running. Use the recordings meanwhile." };
  lastCall.set(ip, now);
  inFlight++;
  const t0 = Date.now();
  try {
    const token = tokenConfigured() ? (process.env.HF_TOKEN as `hf_${string}`) : undefined;
    const call = (async () => {
      const client = await Client.connect(SPACE_ID, token ? { token } : {});
      return client.predict(ENDPOINT, { problem: v.value, max_new_tokens: clampTokens(tokensIn) });
    })();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, rej) => {
      timer = setTimeout(() => rej(new Error(`No response from the Space within ${TIMEOUT_MS / 1000}s.`)), TIMEOUT_MS);
    });
    const res = await Promise.race([call, timeout]).finally(() => clearTimeout(timer));
    const data = (res as { data?: unknown }).data;
    const [b, e] = Array.isArray(data) ? data : [];
    const elapsedMs = Date.now() - t0;
    if (typeof b !== "string" || typeof e !== "string") {
      return { ...base(), status: "error", elapsedMs, message: "The Space returned an unexpected payload." };
    }
    if (isSpaceUnavailableText(b) || isSpaceUnavailableText(e)) {
      return { ...base(), status: "unavailable", elapsedMs, message: b.slice(0, 600) };
    }
    return { ...base(), status: "ok", elapsedMs, base: b, edited: e };
  } catch (e) {
    const msg = errText(e).slice(0, 600);
    const quota = isSpaceUnavailableText(msg) || /429|rate/i.test(msg);
    return { ...base(), status: quota ? "unavailable" : "error", elapsedMs: Date.now() - t0, message: msg };
  } finally {
    inFlight--;
  }
}
