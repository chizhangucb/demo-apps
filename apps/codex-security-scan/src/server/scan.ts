import "server-only";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sampleFixture from "../../data/sample-findings.json";
import chronicleFixture from "../../data/chronicle-findings.json";
import type {
  Capabilities,
  Checkout,
  Finding,
  PatchPreview,
  ScanMode,
  ScanResult,
  Severity,
  TargetId,
} from "@/lib/types";
import { CHRONICLE_REPO, getChronicle } from "./chronicle";

const SAMPLE_DIR = path.join(process.cwd(), "samples", "vuln-notes");
const SDK_VERSION = "0.1.31";
const LIVE_MAX_COST_USD = Number(process.env.CODEX_SECURITY_MAX_COST_USD ?? 2);

type Fixture = { label: string; findings: Finding[]; pinnedCommit?: string };
const FIXTURES: Record<TargetId, Fixture> = {
  sample: sampleFixture as Fixture,
  chronicle: chronicleFixture as Fixture,
};

const hasKey = () => Boolean(process.env.OPENAI_API_KEY || process.env.CODEX_API_KEY);

function hasBin(bin: string, args: string[]) {
  try {
    execFileSync(bin, args, { stdio: "ignore", timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

let caps: Capabilities | null = null;
export function capabilities(): Capabilities {
  caps ??= {
    hasApiKey: hasKey(),
    sdkVersion: SDK_VERSION,
    python: hasBin(process.env.PYTHON ?? "python3", ["--version"]),
    git: hasBin("git", ["--version"]),
  };
  return { ...caps, hasApiKey: hasKey() };
}

// ---------- target acquisition ----------

type Prepared = { dir: string | null; checkout: Checkout; warnings: string[] };

async function prepareTarget(target: TargetId): Promise<Prepared> {
  if (target === "sample") {
    const files = await countFiles(SAMPLE_DIR).catch(() => 0);
    return {
      dir: files ? SAMPLE_DIR : null,
      checkout: { repo: "samples/vuln-notes", commit: null, files, source: "bundled" },
      warnings: files ? [] : ["Bundled sample not found in this deployment; showing fixture snippets."],
    };
  }
  try {
    const c = await withTimeout(getChronicle(), 25_000);
    return { dir: c.dir, checkout: { ...c, dir: undefined } as Checkout, warnings: [] };
  } catch (err) {
    return {
      dir: null,
      checkout: {
        repo: CHRONICLE_REPO,
        commit: FIXTURES.chronicle.pinnedCommit ?? null,
        files: 0,
        source: "pinned",
        note: `fetch failed: ${(err as Error).message}`,
      },
      warnings: [`Couldn't fetch ${CHRONICLE_REPO} (${(err as Error).message}); showing findings pinned to ${FIXTURES.chronicle.pinnedCommit?.slice(0, 7)}.`],
    };
  }
}

async function verifySnippets(dir: string | null, findings: Finding[]): Promise<Finding[]> {
  if (!dir) return findings;
  return Promise.all(
    findings.map(async (f) => {
      if (!f.snippet || !f.startLine || !f.endLine) return f;
      try {
        const lines = (await fs.readFile(path.join(dir, f.path), "utf8")).split("\n");
        return { ...f, verified: lines.slice(f.startLine - 1, f.endLine).join("\n") === f.snippet };
      } catch {
        return { ...f, verified: false };
      }
    }),
  );
}

// ---------- scan ----------

export async function runScan(target: TargetId, mode: ScanMode): Promise<ScanResult> {
  const t0 = Date.now();
  const prepared = await prepareTarget(target);
  const warnings = [...prepared.warnings];
  const base = { target, label: FIXTURES[target].label, mode, checkout: prepared.checkout };

  if (mode !== "scripted") {
    const reason = sdkUnavailable(mode, prepared.dir);
    if (reason) {
      warnings.push(`${reason} — fell back to scripted findings.`);
    } else {
      try {
        const sdk = await runSdk(target, prepared.dir!, mode === "sdk-mock");
        return { ...base, ranAs: mode, ...sdk, durationMs: Date.now() - t0, warnings };
      } catch (err) {
        warnings.push(`Codex Security ${mode} scan failed: ${(err as Error).message.slice(0, 300)} — fell back to scripted findings.`);
      }
    }
  }

  const findings = await verifySnippets(prepared.dir, FIXTURES[target].findings);
  return { ...base, ranAs: "scripted", findings, durationMs: Date.now() - t0, warnings };
}

function sdkUnavailable(mode: ScanMode, dir: string | null): string | null {
  const c = capabilities();
  if (!dir) return "No checkout available";
  if (mode === "live" && !c.hasApiKey) return "OPENAI_API_KEY is not set";
  if (!c.python) return "Codex Security needs Python 3.10+, which this host lacks";
  if (!c.git) return "Codex Security needs git, which this host lacks";
  return null;
}

async function runSdk(target: TargetId, dir: string, mock: boolean) {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), `css-${target}-`));
  const repo = path.join(work, "repo");
  await fs.cp(dir, repo, { recursive: true });
  const git = (...a: string[]) => execFileSync("git", a, { cwd: repo, stdio: "ignore" });
  git("init", "-q");
  git("add", "-A");
  git("-c", "user.email=demo@localhost", "-c", "user.name=demo", "commit", "-qm", "snapshot");

  process.env.CODEX_SECURITY_STATE_DIR ??= path.join(os.tmpdir(), "codex-security-state");
  const { CodexSecurity } = await import("@openai/codex-security");
  const security = new CodexSecurity({ codexOverrides: { analytics: { enabled: false } } });
  try {
    const result = await security.run(repo, {
      outputDir: path.join(work, "results"),
      ...(mock
        ? { mock: true }
        : {
            auth: "api-key" as const,
            maxCostUsd: LIVE_MAX_COST_USD,
            // Keep the chronicle live scan to the local HTTP API surface.
            ...(target === "chronicle" ? { target: ["server"] } : {}),
          }),
    });
    const report = await fs.readFile(result.reportPath, "utf8").catch(() => "");
    return {
      findings: result.findings.findings.map(mapFinding),
      reportExcerpt: report.slice(0, 1500),
    };
  } finally {
    await security.close();
    await fs.rm(work, { recursive: true, force: true });
  }
}

type SdkFinding = {
  findingId?: string;
  occurrenceId?: string;
  ruleId?: string;
  title: string;
  summary?: string;
  severity?: { level?: string };
  confidence?: { level?: string; rationale?: string };
  taxonomy?: { cwe?: string[] };
  locations?: { path: string; startLine?: number; endLine?: number }[];
  codeEvidence?: { code?: string }[];
  remediation?: string;
};

function mapFinding(raw: unknown, i: number): Finding {
  const f = raw as SdkFinding;
  const loc = f.locations?.[0];
  const level = f.severity?.level === "informational" ? "info" : f.severity?.level;
  return {
    id: f.occurrenceId ?? f.findingId ?? `sdk-${i}`,
    ruleId: f.ruleId ?? "codex-security",
    title: f.title,
    severity: (["critical", "high", "medium", "low", "info"].includes(level ?? "") ? level : "info") as Severity,
    confidence: (f.confidence?.level as Finding["confidence"]) ?? "medium",
    cwe: f.taxonomy?.cwe?.[0],
    path: loc?.path ?? "(repository)",
    startLine: loc?.startLine,
    endLine: loc?.endLine,
    snippet: f.codeEvidence?.[0]?.code,
    rationale: f.summary ?? f.confidence?.rationale ?? "",
    remediation: f.remediation ?? "",
    patch: null,
  };
}

// ---------- patch preview ----------

export async function previewPatch(
  target: TargetId,
  mode: ScanMode,
  finding: Pick<Finding, "id" | "title" | "path" | "startLine" | "remediation" | "patch">,
): Promise<PatchPreview> {
  const fixture = FIXTURES[target].findings.find((f) => f.id === finding.id);
  const out: PatchPreview = {
    findingId: finding.id,
    mode: "scripted",
    patch: fixture?.patch ?? finding.patch ?? null,
    remediation: fixture?.remediation ?? finding.remediation,
    warnings: [],
  };
  if (mode !== "live") return out;

  const prepared = await prepareTarget(target);
  const reason = sdkUnavailable("live", prepared.dir);
  if (reason) {
    out.warnings.push(`${reason} — showing the scripted patch preview.`);
    return out;
  }
  // Live: have Codex Security re-validate the finding against the checkout.
  // Patching itself stays read-only here; the diff is a preview, never applied.
  try {
    const { CodexSecurity } = await import("@openai/codex-security");
    const security = new CodexSecurity({ codexOverrides: { analytics: { enabled: false } } });
    try {
      const work = await fs.mkdtemp(path.join(os.tmpdir(), "css-validate-"));
      const v = await security.validate({
        repositoryPath: prepared.dir!,
        finding: { title: finding.title, location: `${finding.path}:${finding.startLine ?? 1}` },
        outputDir: path.join(work, "out"),
        auth: "api-key",
      });
      return { ...out, mode: "live", disposition: v.disposition, report: v.report.slice(0, 4000) };
    } finally {
      await security.close();
    }
  } catch (err) {
    out.warnings.push(`Live validation failed: ${(err as Error).message.slice(0, 300)}`);
    return out;
  }
}

// ---------- utils ----------

async function countFiles(dir: string): Promise<number> {
  let n = 0;
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    n += e.isDirectory() ? await countFiles(path.join(dir, e.name)) : 1;
  }
  return n;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timed out after ${ms / 1000}s`)), ms)),
  ]);
}
