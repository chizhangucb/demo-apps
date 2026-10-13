import { PORT } from "./envelope";
import { sha256Hex } from "./sha256";
import type { FetchItem } from "./types";

export const GRANT_TTL_MS = 24 * 3_600_000;

export interface FileGrant {
  token: string;
  name: string;
  mime: string;
  bytes: Uint8Array;
  /** Only this FQDN may fetch the file. */
  to: string;
  expiresAt: number;
}

/** The sender's outbox: files copied into token dirs and served at GET /f/<token>/<name>. */
export class Outbox {
  grants = new Map<string, FileGrant>();
  constructor(private host: string) {}

  async grant(token: string, name: string, mime: string, bytes: Uint8Array, to: string, now: number): Promise<FetchItem> {
    const copy = new Uint8Array(bytes);
    this.grants.set(token, { token, name, mime, bytes: copy, to, expiresAt: now + GRANT_TTL_MS });
    return {
      name,
      url: `http://${this.host}:${PORT}/f/${token}/${name}`,
      sha256: await sha256Hex(copy),
      size: copy.length,
      mime,
      expires: new Date(now + GRANT_TTL_MS).toISOString(),
    };
  }

  /** Flip bytes in the served copy after the envelope was sent. Size is unchanged. */
  tamper(token: string): boolean {
    const g = this.grants.get(token);
    if (!g || !g.bytes.length) return false;
    for (let i = 0; i < g.bytes.length; i += 97) g.bytes[i] ^= 0x20;
    return true;
  }

  serve(path: string, requester: string, now: number): { status: number; bytes?: Uint8Array; error?: string } {
    const m = /^\/f\/([^/]+)\/([^/]+)$/.exec(path);
    const g = m && this.grants.get(m[1]);
    if (!g || g.name !== m![2]) return { status: 404, error: "no such file" };
    if (requester !== g.to) return { status: 403, error: "file is only served to the to machine" };
    if (now > g.expiresAt) return { status: 410, error: "grant expired" };
    return { status: 200, bytes: new Uint8Array(g.bytes) };
  }
}

export type FetchResult =
  | { ok: true; bytes: Uint8Array; computed: string; steps: string[] }
  | { ok: false; error: string; computed?: string; steps: string[] };

/**
 * Recipient side fetch: write .part, check size and SHA-256, rename only on match.
 * On mismatch the .part file is deleted and an error is reported.
 */
export async function fetchAndVerify(
  item: FetchItem,
  outbox: Outbox,
  requester: string,
  now: number,
  disk: Map<string, Uint8Array>,
): Promise<FetchResult> {
  const steps: string[] = [];
  const url = new URL(item.url);
  const res = outbox.serve(url.pathname, requester, now);
  steps.push(`GET ${url.pathname} -> ${res.status}`);
  if (!res.bytes) return { ok: false, error: `fetch failed: ${res.status} ${res.error}`, steps };
  const part = `${item.name}.part`;
  disk.set(part, res.bytes);
  steps.push(`wrote ${part} (${res.bytes.length} bytes)`);
  if (res.bytes.length !== item.size) {
    disk.delete(part);
    steps.push(`deleted ${part}`);
    return { ok: false, error: `size mismatch: expected ${item.size}, got ${res.bytes.length}`, steps };
  }
  const computed = await sha256Hex(res.bytes);
  if (computed !== item.sha256) {
    disk.delete(part);
    steps.push(`sha256 mismatch, deleted ${part}`);
    return { ok: false, error: "sha256 mismatch: file changed after it was sent", computed, steps };
  }
  disk.delete(part);
  disk.set(item.name, res.bytes);
  steps.push(`sha256 ok, renamed ${part} -> ${item.name}`);
  return { ok: true, bytes: res.bytes, computed, steps };
}
