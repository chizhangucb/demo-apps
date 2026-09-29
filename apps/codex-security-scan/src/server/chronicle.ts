import "server-only";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import type { Checkout } from "@/lib/types";

// Public repo only — no token is ever sent. Fetch-on-demand into a
// gitignored/tmp cache; callers fall back to scripted fixtures on failure.
export const CHRONICLE_REPO = "chizhangucb/chronicle";
const TARBALL = `https://codeload.github.com/${CHRONICLE_REPO}/tar.gz/refs/heads/main`;
const MAX_BYTES = 40 * 1024 * 1024;

export const cacheRoot = () =>
  process.env.CHRONICLE_CACHE_DIR ?? path.join(os.tmpdir(), "codex-security-scan", "chronicle");

export type ChronicleCheckout = Checkout & { dir: string | null };

let inflight: Promise<ChronicleCheckout> | null = null;

export function getChronicle(): Promise<ChronicleCheckout> {
  inflight ??= fetchChronicle().catch((err) => {
    inflight = null;
    throw err;
  });
  return inflight;
}

async function fetchChronicle(): Promise<ChronicleCheckout> {
  const root = cacheRoot();
  const marker = path.join(root, "checkout.json");
  try {
    const cached = JSON.parse(await fs.readFile(marker, "utf8")) as ChronicleCheckout;
    if (cached.dir && Date.now() - (cached as ChronicleCheckout & { at: number }).at < 60 * 60 * 1000) {
      return { ...cached, source: "cache" };
    }
  } catch {}

  const res = await fetch(TARBALL, { signal: AbortSignal.timeout(20_000), redirect: "follow" });
  if (!res.ok) throw new Error(`GitHub archive fetch failed: HTTP ${res.status}`);
  const gz = Buffer.from(await res.arrayBuffer());
  if (gz.length > MAX_BYTES) throw new Error("chronicle archive larger than cap");
  const { commit, entries } = parseTar(gunzipSync(gz));

  const dir = path.join(root, commit ? commit.slice(0, 12) : `snap-${Date.now()}`);
  await fs.rm(dir, { recursive: true, force: true });
  let files = 0;
  for (const e of entries) {
    const rel = e.name.split("/").slice(1).join("/"); // strip "chronicle-<sha>/"
    if (!rel || rel.split("/").includes("..")) continue;
    const out = path.join(dir, rel);
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, e.data);
    files++;
  }
  const checkout = { repo: CHRONICLE_REPO, commit, files, source: "fetched" as const, dir };
  await fs.writeFile(marker, JSON.stringify({ ...checkout, at: Date.now() }));
  return checkout;
}

type Entry = { name: string; data: Buffer };

/** Minimal ustar/pax reader: regular files only, enough for a GitHub archive. */
function parseTar(buf: Buffer): { commit: string | null; entries: Entry[] } {
  const entries: Entry[] = [];
  let commit: string | null = null;
  let paxPath: string | null = null;
  let off = 0;
  while (off + 512 <= buf.length) {
    const h = buf.subarray(off, off + 512);
    if (h.every((b) => b === 0)) break;
    const str = (a: number, n: number) => { const s = h.subarray(a, a + n).toString("utf8"); const z = s.indexOf("\0"); return z < 0 ? s : s.slice(0, z); };
    const size = parseInt(str(124, 12).trim() || "0", 8);
    const type = String.fromCharCode(h[156] || 48);
    const prefix = str(345, 155);
    const body = buf.subarray(off + 512, off + 512 + size);
    off += 512 + Math.ceil(size / 512) * 512;

    if (type === "g" || type === "x") {
      const recs = parsePax(body);
      if (type === "g" && recs.comment) commit = recs.comment.trim();
      if (type === "x" && recs.path) paxPath = recs.path;
      continue;
    }
    const name = paxPath ?? (prefix ? `${prefix}/${str(0, 100)}` : str(0, 100));
    paxPath = null;
    if (type === "0" || type === "\0") entries.push({ name, data: Buffer.from(body) });
  }
  return { commit, entries };
}

function parsePax(body: Buffer): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < body.length) {
    const sp = body.indexOf(0x20, i);
    if (sp < 0) break;
    const len = parseInt(body.subarray(i, sp).toString(), 10);
    if (!len) break;
    const rec = body.subarray(sp + 1, i + len - 1).toString("utf8");
    const eq = rec.indexOf("=");
    out[rec.slice(0, eq)] = rec.slice(eq + 1);
    i += len;
  }
  return out;
}
