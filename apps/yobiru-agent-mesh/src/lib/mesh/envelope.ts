import { WAKE_LEVELS, type Envelope } from "./types";

export const MAX_BODY_BYTES = 256 * 1024;
export const PORT = 7766;

const ALLOWED = new Set([
  "v", "id", "from", "to", "ts", "kind", "text", "reply_to", "wake",
  "agent", "from_agent", "fetch", "request", "response",
]);
const FETCH_FIELDS = new Set(["name", "url", "sha256", "size", "mime", "expires"]);
const HEX64 = /^[0-9a-f]{64}$/;

export type Validation = { ok: true; envelope: Envelope } | { ok: false; status: 400; error: string };

const bad = (error: string): Validation => ({ ok: false, status: 400, error });

export function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

/** Validates a parsed envelope. Unknown fields are rejected, as the SPEC requires. */
export function validateEnvelope(raw: unknown): Validation {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return bad("envelope must be a JSON object");
  const e = raw as Record<string, unknown>;
  for (const key of Object.keys(e)) if (!ALLOWED.has(key)) return bad(`unknown field "${key}"`);
  if (e.v !== 1) return bad("v must be 1");
  for (const key of ["id", "from", "to", "ts", "kind"]) {
    if (typeof e[key] !== "string" || !(e[key] as string).length) return bad(`missing ${key}`);
  }
  if (e.wake !== undefined && !WAKE_LEVELS.includes(e.wake as never)) return bad(`bad wake value "${String(e.wake)}"`);
  for (const key of ["text", "reply_to", "agent", "from_agent"]) {
    if (e[key] !== undefined && typeof e[key] !== "string") return bad(`${key} must be a string`);
  }
  if (e.fetch !== undefined) {
    if (!Array.isArray(e.fetch)) return bad("fetch must be a list");
    for (const item of e.fetch as Record<string, unknown>[]) {
      for (const key of Object.keys(item)) if (!FETCH_FIELDS.has(key)) return bad(`unknown fetch field "${key}"`);
      if (typeof item.sha256 !== "string" || !HEX64.test(item.sha256)) return bad("fetch sha256 must be 64 hex");
      if (typeof item.size !== "number" || item.size < 0) return bad("fetch size must be a number");
      let host: string;
      try {
        host = new URL(String(item.url)).hostname;
      } catch {
        return bad("fetch url is not a URL");
      }
      if (host !== e.from) return bad("fetch URL not on sender host");
    }
  }
  return { ok: true, envelope: e as unknown as Envelope };
}

export function encodeEnvelope(env: Envelope): string {
  return JSON.stringify(env);
}
