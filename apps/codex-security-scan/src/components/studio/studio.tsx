"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, FileCode2, GitBranch, Loader2, Play, ShieldAlert, Wand2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Capabilities, Finding, PatchPreview, ScanMode, ScanResult, Severity, TargetId } from "@/lib/types";

const TARGETS: { id: TargetId; name: string; blurb: string; href: string }[] = [
  {
    id: "sample",
    name: "Canned sample",
    blurb: "samples/vuln-notes — a tiny notes API with planted bugs",
    href: "https://github.com/chizhangucb/demo-apps/tree/main/apps/codex-security-scan/samples/vuln-notes",
  },
  {
    id: "chronicle",
    name: "Chronicle",
    blurb: "chizhangucb/chronicle — a real local-first product, fetched on demand",
    href: "https://github.com/chizhangucb/chronicle",
  },
];

const MODES: { id: ScanMode; label: string; hint: string }[] = [
  { id: "scripted", label: "Scripted", hint: "Canned findings, snippets verified against the checkout. No keys." },
  { id: "sdk-mock", label: "SDK mock", hint: "Real @openai/codex-security pipeline with mock: true. No keys; needs Python + git." },
  { id: "live", label: "Live", hint: "Real Codex Security scan via OPENAI_API_KEY (server-side)." },
];

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];
const SEV_STYLE: Record<Severity, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-amber-400 text-black",
  low: "bg-sky-500 text-white",
  info: "bg-muted text-muted-foreground",
};

type Lane = { status: "idle" | "running" | "done" | "error"; result?: ScanResult; error?: string; startedAt?: number };

export function Studio({ caps }: { caps: Capabilities }) {
  const [mode, setMode] = useState<ScanMode>("scripted");
  const [lanes, setLanes] = useState<Record<TargetId, Lane>>({ sample: { status: "idle" }, chronicle: { status: "idle" } });
  const [selected, setSelected] = useState<{ target: TargetId; finding: Finding } | null>(null);
  const [patch, setPatch] = useState<{ loading: boolean; data?: PatchPreview }>({ loading: false });

  const sdkReady = caps.python && caps.git;
  const modeDisabled = (m: ScanMode) => (m === "sdk-mock" && !sdkReady) || (m === "live" && (!sdkReady || !caps.hasApiKey));

  async function scan(target: TargetId) {
    setLanes((l) => ({ ...l, [target]: { status: "running", startedAt: Date.now() } }));
    try {
      const res = await fetch("/api/scan", { method: "POST", body: JSON.stringify({ target, mode }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = (await res.json()) as ScanResult;
      setLanes((l) => ({ ...l, [target]: { status: "done", result } }));
    } catch (err) {
      setLanes((l) => ({ ...l, [target]: { status: "error", error: (err as Error).message } }));
    }
  }

  // Fan out: both targets scan in parallel, each lane fills in as it lands.
  const scanBoth = () => {
    setSelected(null);
    setPatch({ loading: false });
    void Promise.all(TARGETS.map((t) => scan(t.id)));
  };

  async function openPatch(target: TargetId, finding: Finding) {
    setSelected({ target, finding });
    setPatch({ loading: true });
    const res = await fetch("/api/patch", { method: "POST", body: JSON.stringify({ target, mode, finding }) });
    setPatch({ loading: false, data: (await res.json()) as PatchPreview });
  }

  const anyRunning = Object.values(lanes).some((l) => l.status === "running");

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldAlert className="size-4" /> Codex Security · dual-target demo
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Codex Security Scan Studio</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Scan a canned vulnerable sample and a real product repo side by side with{" "}
            <a className="underline" href="https://github.com/openai/codex-security" target="_blank" rel="noreferrer">
              @openai/codex-security
            </a>{" "}
            v{caps.sdkVersion}, then preview a fix for any finding.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="inline-flex rounded-lg border p-0.5" role="radiogroup" aria-label="Scan mode">
            {MODES.map((m) => (
              <button
                key={m.id}
                role="radio"
                aria-checked={mode === m.id}
                disabled={modeDisabled(m.id) || anyRunning}
                title={m.hint}
                onClick={() => setMode(m.id)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  mode === m.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <Button onClick={scanBoth} disabled={anyRunning}>
            {anyRunning ? <Loader2 className="animate-spin" /> : <Play />} Scan both targets
          </Button>
        </div>
      </header>

      {!caps.hasApiKey && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Degraded mode — no OPENAI_API_KEY on the server</AlertTitle>
          <AlertDescription>
            Findings come from scripted fixtures (every snippet is re-checked against the live checkout).
            {sdkReady
              ? " SDK mock runs the real Codex Security pipeline with synthetic findings."
              : " This host lacks Python/git, so SDK mock and Live are off; run locally to enable them."}{" "}
            Set <code>OPENAI_API_KEY</code> server-side for a live scan.
          </AlertDescription>
        </Alert>
      )}

      <SeverityCompare lanes={lanes} />

      <section className="grid gap-4 lg:grid-cols-2">
        {TARGETS.map((t) => (
          <TargetColumn
            key={t.id}
            meta={t}
            lane={lanes[t.id]}
            disabled={anyRunning}
            onScan={() => scan(t.id)}
            selectedId={selected?.target === t.id ? selected.finding.id : null}
            onSelect={(f) => openPatch(t.id, f)}
          />
        ))}
      </section>

      {selected && <PatchPanel target={selected.target} finding={selected.finding} state={patch} />}

      <footer className="pb-4 text-xs text-muted-foreground">
        Built on{" "}
        <a className="underline" href="https://developers.openai.com/codex/security" target="_blank" rel="noreferrer">
          Codex Security
        </a>{" "}
        · inspired by{" "}
        <a className="underline" href="https://x.com/OpenAI/status/2082263717916586117" target="_blank" rel="noreferrer">
          @OpenAI
        </a>{" "}
        · scan target{" "}
        <a className="underline" href="https://github.com/chizhangucb/chronicle" target="_blank" rel="noreferrer">
          chizhangucb/chronicle
        </a>
        . Patch previews are never applied or pushed.
      </footer>
    </main>
  );
}

function SeverityCompare({ lanes }: { lanes: Record<TargetId, Lane> }) {
  const counts = (id: TargetId) => {
    const f = lanes[id].result?.findings ?? [];
    return Object.fromEntries(SEVERITIES.map((s) => [s, f.filter((x) => x.severity === s).length])) as Record<Severity, number>;
  };
  if (!lanes.sample.result && !lanes.chronicle.result) return null;
  const a = counts("sample");
  const b = counts("chronicle");
  return (
    <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] items-center gap-x-2 gap-y-1 rounded-lg border p-3 text-sm">
      <span />
      {SEVERITIES.map((s) => (
        <span key={s} className="text-center text-xs capitalize text-muted-foreground">
          {s}
        </span>
      ))}
      {(["sample", "chronicle"] as const).map((id) => (
        <div key={id} className="contents">
          <span className="pr-2 font-medium">{id === "sample" ? "Sample" : "Chronicle"}</span>
          {SEVERITIES.map((s) => {
            const n = (id === "sample" ? a : b)[s];
            return (
              <span
                key={s}
                className={cn("rounded py-0.5 text-center tabular-nums", n ? SEV_STYLE[s] : "text-muted-foreground/50")}
              >
                {lanes[id].result ? n : "–"}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function TargetColumn({
  meta,
  lane,
  disabled,
  onScan,
  selectedId,
  onSelect,
}: {
  meta: (typeof TARGETS)[number];
  lane: Lane;
  disabled: boolean;
  onScan: () => void;
  selectedId: string | null;
  onSelect: (f: Finding) => void;
}) {
  const r = lane.result;
  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              {meta.id === "sample" ? <FileCode2 className="size-4" /> : <GitBranch className="size-4" />}
              {meta.name}
            </CardTitle>
            <CardDescription>
              <a className="hover:underline" href={meta.href} target="_blank" rel="noreferrer">
                {meta.blurb}
              </a>
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={onScan} disabled={disabled}>
            {lane.status === "running" ? <Loader2 className="animate-spin" /> : <Play />} Scan
          </Button>
        </div>
        {r && (
          <div className="flex flex-wrap gap-1.5 pt-1 text-xs">
            <Badge variant="outline">ran as {r.ranAs}</Badge>
            <Badge variant="outline">
              {r.checkout.source === "fetched" || r.checkout.source === "cache" ? "checkout" : r.checkout.source}
              {r.checkout.commit ? ` @ ${r.checkout.commit.slice(0, 7)}` : ""}
              {r.checkout.files ? ` · ${r.checkout.files} files` : ""}
            </Badge>
            <Badge variant="outline">{(r.durationMs / 1000).toFixed(1)}s</Badge>
            <Badge variant="outline">{r.findings.length} findings</Badge>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {lane.status === "idle" && <p className="py-8 text-center text-sm text-muted-foreground">Not scanned yet.</p>}
        {lane.status === "running" && (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {meta.id === "chronicle" ? "Fetching chronicle archive and scanning…" : "Scanning sample…"}
          </p>
        )}
        {lane.status === "error" && <p className="text-sm text-destructive">Scan failed: {lane.error}</p>}
        {r?.warnings.map((w) => (
          <p key={w} className="rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
            {w}
          </p>
        ))}
        {r?.findings.map((f) => (
          <button
            key={f.id}
            onClick={() => onSelect(f)}
            className={cn(
              "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-muted/60",
              selectedId === f.id && "border-primary ring-1 ring-primary",
            )}
          >
            <div className="flex items-start gap-2">
              <span className={cn("mt-0.5 shrink-0 rounded px-1.5 text-[11px] font-semibold uppercase", SEV_STYLE[f.severity])}>
                {f.severity}
              </span>
              <span className="text-sm font-medium leading-snug">{f.title}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-xs text-muted-foreground">
              <span className="break-all">
                {f.path}
                {f.startLine ? `:${f.startLine}` : ""}
              </span>
              {f.cwe && <span>{f.cwe}</span>}
              <span>conf {f.confidence}</span>
              {f.verified && (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3" /> snippet matches checkout
                </span>
              )}
              {f.patch && (
                <span className="flex items-center gap-1">
                  <Wand2 className="size-3" /> patch
                </span>
              )}
            </div>
            <p className="line-clamp-2 text-xs text-muted-foreground">{f.rationale}</p>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function PatchPanel({
  target,
  finding,
  state,
}: {
  target: TargetId;
  finding: Finding;
  state: { loading: boolean; data?: PatchPreview };
}) {
  const d = state.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="size-4" /> Patch preview — {target === "sample" ? "Sample" : "Chronicle"}
        </CardTitle>
        <CardDescription>{finding.title}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3 text-sm">
          <p>{finding.rationale}</p>
          {finding.snippet && (
            <div>
              <div className="mb-1 font-mono text-xs text-muted-foreground">
                {finding.path}:{finding.startLine}
                {finding.endLine && finding.endLine !== finding.startLine ? `-${finding.endLine}` : ""}
              </div>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">{finding.snippet}</pre>
            </div>
          )}
          <p>
            <span className="font-medium">Remediation: </span>
            {d?.remediation ?? finding.remediation}
          </p>
          {d?.disposition && (
            <p>
              <Badge>live validation: {d.disposition}</Badge>
            </p>
          )}
          {d?.warnings.map((w) => (
            <p key={w} className="text-xs text-amber-700 dark:text-amber-300">
              {w}
            </p>
          ))}
        </div>
        <div className="min-w-0">
          {state.loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Preparing patch…
            </p>
          )}
          {d && (d.patch ? <Diff patch={d.patch} /> : <p className="text-sm text-muted-foreground">No patch for this finding — see remediation.</p>)}
          {d?.report && (
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-md border p-3 text-xs">{d.report}</pre>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Diff({ patch }: { patch: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border bg-muted/40 py-2 font-mono text-xs leading-relaxed">
      {patch.replace(/\n$/, "").split("\n").map((line, i) => (
        <div
          key={i}
          className={cn(
            "px-3",
            line.startsWith("+") && !line.startsWith("+++") && "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
            line.startsWith("-") && !line.startsWith("---") && "bg-red-500/15 text-red-800 dark:text-red-300",
            line.startsWith("@@") && "text-sky-700 dark:text-sky-300",
            (line.startsWith("+++") || line.startsWith("---")) && "font-semibold text-muted-foreground",
          )}
        >
          {line || " "}
        </div>
      ))}
    </pre>
  );
}
