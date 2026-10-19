"use client";

import { useState } from "react";
import { Download, Play } from "lucide-react";
import type { DcfConfig, ResearchRun, Valuation } from "@/lib/types";
import { stamp } from "./source-tag";

export function AssumptionsPanel({ run, onRevalue }: { run: ResearchRun; onRevalue: (config: DcfConfig, v: Valuation) => void }) {
  const [text, setText] = useState(() => JSON.stringify(run.assumptions, null, 2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const href = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(run.assumptions, null, 2))}`;

  async function rerun() {
    setBusy(true);
    setError(null);
    try {
      const config = JSON.parse(text) as DcfConfig;
      const res = await fetch("/api/value", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(config) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      onRevalue(config, body as Valuation);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-2">
      <div className="min-w-0">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Assumptions JSON (dcf.py --config)</h3>
          <div className="flex gap-1">
            <a
              href={href}
              download={`${run.company.ticker}-assumptions.json`}
              className="inline-flex items-center gap-1 border border-border px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              <Download className="size-3" /> Save
            </a>
            <button
              type="button"
              onClick={rerun}
              disabled={busy}
              className="inline-flex items-center gap-1 border border-amber px-2 py-1 text-[10px] uppercase tracking-wide text-amber hover:bg-amber hover:text-black disabled:opacity-50"
            >
              <Play className="size-3" /> {busy ? "Running" : "Re-run dcf.py"}
            </button>
          </div>
        </div>
        <p className="mb-2 text-[11px] text-muted-foreground">
          <span className="text-amber">My view inputs:</span> {run.inputs.rationale}
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          className="num h-80 w-full resize-y border border-border bg-panel p-2 text-[11px] leading-snug text-foreground/90 outline-none focus:border-amber"
          aria-label="Assumptions JSON"
        />
        {error && <p className="mt-1 text-[11px] text-down">dcf.py error: {error}</p>}
      </div>
      <div className="min-w-0">
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">dcf.py transcript</h3>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Ran via {run.valuation.runner} at <span className="num">{stamp(run.valuation.ranAt)}</span>. Upstream prints in Chinese; the structured numbers above come from the same functions.
        </p>
        <pre className="num h-[22.5rem] overflow-auto border border-border bg-panel p-2 text-[11px] leading-snug whitespace-pre-wrap text-foreground/80">{run.valuation.transcript}</pre>
      </div>
    </div>
  );
}
