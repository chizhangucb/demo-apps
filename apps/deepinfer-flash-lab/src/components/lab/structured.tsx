"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Braces, Check, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ModeInfo } from "@/lib/mode";
import type { ValidationReport } from "@/lib/validate";
import { cn } from "cn";
import { STRUCTURED_PRESETS } from "../../../data/samples/presets";
import { fmt, LiveTag, Panel, SampleTag, Src } from "./bits";

type Result = {
  info: ModeInfo;
  sample: boolean;
  note?: string;
  raw: string;
  serverMs: number;
  validation: ValidationReport;
  clientMs: number;
};

export function StructuredPanel({ sampleMode }: { sampleMode: boolean }) {
  const [presetId, setPresetId] = useState(STRUCTURED_PRESETS[0].id);
  const preset = STRUCTURED_PRESETS.find((p) => p.id === presetId)!;
  const [schemaText, setSchemaText] = useState(JSON.stringify(preset.schema, null, 2));
  const [prompt, setPrompt] = useState(preset.prompt);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoRan = useRef(false);

  const choose = (id: string) => {
    const p = STRUCTURED_PRESETS.find((s) => s.id === id)!;
    setPresetId(id);
    setSchemaText(JSON.stringify(p.schema, null, 2));
    setPrompt(p.prompt);
    setResult(null);
  };

  const submit = useCallback(async (id: string, schemaSrc: string, promptText: string) => {
    let schema: unknown;
    try {
      schema = JSON.parse(schemaSrc);
    } catch (err) {
      setError(`Schema is not valid JSON: ${err instanceof Error ? err.message : ""}`);
      return;
    }
    setBusy(true);
    setError(null);
    const t0 = performance.now();
    try {
      const res = await fetch("/api/structured", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId: id, schema, prompt: promptText }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setResult({ ...json, clientMs: performance.now() - t0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (sampleMode && !autoRan.current) {
      autoRan.current = true;
      const p = STRUCTURED_PRESETS[1];
      setPresetId(p.id);
      setSchemaText(JSON.stringify(p.schema, null, 2));
      setPrompt(p.prompt);
      submit(p.id, JSON.stringify(p.schema), p.prompt);
    }
  }, [sampleMode, submit]);

  const v = result?.validation;

  return (
    <Panel
      channel="CH.03"
      title="Structured output"
      tag={result ? result.sample ? <SampleTag /> : <LiveTag>{result.info.label}</LiveTag> : sampleMode ? <SampleTag /> : null}
      right={
        <span className="hidden font-mono text-[10px] text-muted-foreground md:inline">
          JSON mode <Src k="jsonMode" /> + Ajv validation here; DeepInfer masks sampling with a grammar automaton <Src k="qa" />
        </span>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {STRUCTURED_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => choose(p.id)}
            className={cn(
              "border px-2.5 py-1 font-mono text-[11px] transition",
              presetId === p.id ? "border-cyan-glow/70 bg-cyan-glow/10 text-cyan-glow" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {p.title}
          </button>
        ))}
        {preset.id === "deepinfer-example" && <Src k="structuredExample" label="upstream example" className="ml-1" />}
        <div className="ml-auto flex items-center gap-2">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-[min(420px,60vw)] border border-border bg-black/40 px-2 py-1 font-mono text-[11.5px] outline-none focus:border-cyan-glow/60"
          />
          <Button size="sm" disabled={busy} onClick={() => submit(presetId, schemaText, prompt)} className="font-mono tracking-wider">
            <Play /> {busy ? "RUNNING" : "GENERATE"}
          </Button>
        </div>
      </div>
      <p className="mb-3 font-mono text-[10.5px] text-muted-foreground">
        DeepInfer enforces the schema inside sampling with a grammar mask; the hosted API JSON mode is validated after the fact here.
      </p>
      {error && <div className="mb-3 border border-fail/40 bg-fail/5 px-3 py-1.5 font-mono text-[11px] text-fail">{error}</div>}
      {result?.note && <div className="mb-3 border border-amber-glow/40 bg-amber-glow/5 px-3 py-1.5 font-mono text-[11px] text-amber-glow">{result.note}</div>}

      <div className="grid gap-3 lg:grid-cols-3">
        <Column title="SCHEMA (editable)" icon={<Braces className="size-3" />}>
          <textarea
            value={schemaText}
            onChange={(e) => setSchemaText(e.target.value)}
            spellCheck={false}
            className="h-[300px] w-full resize-none bg-transparent font-mono text-[11.5px] leading-snug text-foreground/90 outline-none"
          />
        </Column>
        <Column
          title="RETURNED JSON"
          right={
            result && (
              <span className={cn("font-mono text-[10px]", result.sample ? "text-amber-glow" : "text-pass")}>
                {result.sample ? "SAMPLE, " : ""}
                {fmt(result.clientMs)} ms round trip
              </span>
            )
          }
        >
          <pre className="h-[300px] overflow-auto font-mono text-[11.5px] leading-snug text-cyan-glow/90">
            {busy ? "waiting for model..." : result ? result.raw || "(empty content)" : "--"}
          </pre>
        </Column>
        <Column
          title="VALIDATION (Ajv)"
          right={
            v && (
              <span
                className={cn(
                  "border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.18em]",
                  v.valid ? "glow-cyan border-pass/60 bg-pass/10 text-pass" : "border-fail/60 bg-fail/10 text-fail",
                )}
              >
                {v.valid ? "PASS" : "FAIL"}
              </span>
            )
          }
        >
          <div className="h-[300px] space-y-1.5 overflow-auto">
            {!v && <div className="font-mono text-[11px] text-muted-foreground">--</div>}
            {v?.parseError && <Row ok={false} field="(parse)" detail={v.parseError} />}
            {v?.schemaError && <Row ok={false} field="(schema)" detail={v.schemaError} />}
            {v?.fields.map((f) => (
              <Row
                key={f.field}
                ok={f.ok}
                field={f.field}
                detail={f.ok ? (f.present ? JSON.stringify(f.value)?.slice(0, 48) : "absent (optional)") : f.messages.join("; ")}
              />
            ))}
            {v?.rootErrors.map((e) => <Row key={e} ok={false} field="(root)" detail={e} />)}
          </div>
        </Column>
      </div>
    </Panel>
  );
}

function Column({ title, icon, right, children }: { title: string; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-[#03070a]">
      <div className="flex items-center gap-1.5 border-b border-border/80 px-3 py-1.5 font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
        {icon}
        {title}
        <span className="ml-auto">{right}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function Row({ ok, field, detail }: { ok: boolean; field: string; detail: string }) {
  return (
    <div className={cn("flex items-start gap-2 border px-2 py-1.5 font-mono text-[11px]", ok ? "border-pass/25 bg-pass/5" : "border-fail/40 bg-fail/10")}>
      {ok ? <Check className="mt-0.5 size-3 shrink-0 text-pass" /> : <X className="mt-0.5 size-3 shrink-0 text-fail" />}
      <span className={cn("font-semibold", ok ? "text-pass" : "text-fail")}>{field}</span>
      <span className="truncate text-muted-foreground">{detail}</span>
    </div>
  );
}
