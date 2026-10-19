import "server-only";
import { spawn } from "node:child_process";
import path from "node:path";
import type { DcfConfig, Valuation } from "@/lib/types";

const TIMEOUT_MS = 20_000;

type RunnerOut = { ok: true; result: Omit<Valuation, "ranAt" | "runner"> } | { ok: false; error: string };

function capped(config: DcfConfig): DcfConfig {
  const mc = config.montecarlo as { n?: number } | undefined;
  return mc ? { ...config, montecarlo: { ...mc, n: Math.min(mc.n ?? 2000, 5000) } } : config;
}

/** Run python/runner.py (which imports the vendored dcf.py) with a local python3. */
export function runLocal(config: DcfConfig): Promise<RunnerOut> {
  return new Promise((resolve, reject) => {
    const script = path.join(process.cwd(), "python", "runner.py");
    const child = spawn("python3", ["-I", script], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), TIMEOUT_MS);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(out) as RunnerOut);
      } catch {
        reject(new Error(err.trim() || "dcf.py produced no JSON"));
      }
    });
    child.stdin.end(JSON.stringify(capped(config)));
  });
}

/** On Vercel the Node function has no python3, so call the sibling Python function at /api/dcf. */
async function runRemote(config: DcfConfig, origin: string): Promise<RunnerOut> {
  const res = await fetch(`${origin}/api/dcf`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(capped(config)),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return (await res.json()) as RunnerOut;
}

export async function runDcf(config: DcfConfig, origin: string): Promise<Valuation> {
  let out: RunnerOut;
  let runner = "python3 (local)";
  try {
    out = await runLocal(config);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    runner = "Vercel Python function /api/dcf";
    out = await runRemote(config, origin);
  }
  if (!out.ok) throw new Error(`dcf.py rejected the assumptions: ${out.error}`);
  return { ...out.result, ranAt: new Date().toISOString(), runner };
}
