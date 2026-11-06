"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { detectRepetition, closesThinking, hasBoxed, lastBoxed } from "@/lib/text";
import { nf } from "@/lib/fmt";
import { cn } from "@/lib/utils";

type Props = {
  side: "base" | "edited";
  model: string;
  sourceLabel: string;
  text: string;
  rawChars: number;
  revealed: number;
  playing: boolean;
  modeTag: "RECORDED" | "LIVE";
};

const MAX_MARKS = 400;

function renderWithQuery(text: string, q: string, keyBase: string, budget: { left: number }) {
  if (!q || budget.left <= 0) return text;
  const out: React.ReactNode[] = [];
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  let i = 0;
  let k = 0;
  while (budget.left > 0) {
    const j = lower.indexOf(ql, i);
    if (j < 0) break;
    if (j > i) out.push(text.slice(i, j));
    out.push(<mark key={`${keyBase}-${k++}`}>{text.slice(j, j + q.length)}</mark>);
    budget.left--;
    i = j + q.length;
  }
  out.push(text.slice(i));
  return out;
}

export function OutputPane({ side, model, sourceLabel, text, rawChars, revealed, playing, modeTag }: Props) {
  const [query, setQuery] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const rep = useMemo(() => detectRepetition(text), [text]);
  const shown = Math.min(revealed, text.length);
  const done = shown >= text.length;
  const visibleText = text.slice(0, shown);
  const boxed = useMemo(() => (done ? lastBoxed(text) : lastBoxed(visibleText)), [done, text, visibleText]);
  const thinkClosed = closesThinking(visibleText);
  const boxedPresent = hasBoxed(visibleText);

  const matchCount = useMemo(() => {
    if (query.length < 2) return 0;
    const l = text.toLowerCase();
    const q = query.toLowerCase();
    let n = 0;
    for (let i = l.indexOf(q); i >= 0; i = l.indexOf(q, i + q.length)) n++;
    return n;
  }, [query, text]);

  useEffect(() => {
    if (playing && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [shown, playing]);

  const body = useMemo(() => {
    const nodes: React.ReactNode[] = [];
    let used = 0;
    const budget = { left: query.length >= 2 ? MAX_MARKS : 0 };
    for (let s = 0; s < rep.segments.length && used < shown; s++) {
      const seg = rep.segments[s];
      const piece = seg.text.slice(0, shown - used);
      used += piece.length;
      const content = renderWithQuery(piece, query.length >= 2 ? query : "", `s${s}`, budget);
      nodes.push(seg.repeat ? <span key={s} className="rep">{content}</span> : <span key={s}>{content}</span>);
    }
    return nodes;
  }, [rep, shown, query]);

  const accent = side === "base" ? "var(--base)" : "var(--edited)";
  const trimmedNote = rawChars !== text.length;

  return (
    <section className="lab-panel flex min-h-0 flex-col overflow-hidden" aria-label={`${side} model output`}>
      <header className="border-b border-border px-4 pt-3 pb-3" style={{ boxShadow: `inset 0 2px 0 ${accent}` }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="lab-label" style={{ color: accent }}>{side === "base" ? "A / base" : "B / weight-edited"}</div>
            <div className="truncate font-mono text-[13px] font-medium text-foreground">{model}</div>
          </div>
          <span
            className={cn(
              "rounded-sm border px-1.5 py-0.5 font-mono text-[10px] tracking-widest",
              modeTag === "LIVE" ? "border-edited/60 text-edited" : "border-border text-muted-foreground",
            )}
          >
            {modeTag}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground sm:grid-cols-4">
          <div>
            <span className="text-foreground tabular-nums">{nf.format(shown)}</span> / {nf.format(text.length)} chars
          </div>
          <Indicator ok={thinkClosed} label="</think> closed" />
          <Indicator ok={boxedPresent} label="\boxed{} present" />
          <div className={cn(rep.repeatedLines > 0 ? "text-base" : "")}>
            {rep.repeatedLines > 0 ? `repetition: ${nf.format(rep.repeatedLines)} repeated lines` : "no exact repeated lines"}
          </div>
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">{sourceLabel}</div>
        {trimmedNote && (
          <div className="mt-1 text-[11px] text-muted-foreground">
            Source string is {nf.format(rawChars)} chars; {nf.format(rawChars - text.length)} trailing whitespace chars trimmed for display. Wording untouched.
          </div>
        )}
      </header>
      <div className="flex items-center gap-2 border-b border-border px-4 py-1.5">
        <Search className="size-3.5 text-muted-foreground" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="find in answer"
          aria-label={`find in ${side} answer`}
          className="min-w-0 flex-1 bg-transparent font-mono text-[12px] outline-none placeholder:text-muted-foreground/60"
        />
        {query.length >= 2 && (
          <span className="font-mono text-[11px] text-muted-foreground">
            {nf.format(matchCount)} match{matchCount === 1 ? "" : "es"}
            {matchCount > MAX_MARKS ? ` (first ${MAX_MARKS} highlighted)` : ""}
          </span>
        )}
      </div>
      <div ref={scroller} className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className={cn("output-text text-foreground/90", playing && !done && (side === "base" ? "caret caret-base" : "caret"))}>{body}</div>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 font-mono text-[11px]">
        <span className="text-muted-foreground">last \boxed{"{}"}:</span>
        <span className={cn("max-w-[70%] truncate", boxed ? "text-foreground" : "text-muted-foreground")}>{boxed ?? "none in shown text"}</span>
      </footer>
      <div className="h-0.5 w-full bg-muted">
        <div className="h-full transition-[width] duration-75" style={{ width: `${text.length ? (shown / text.length) * 100 : 0}%`, background: accent }} />
      </div>
    </section>
  );
}

function Indicator({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("inline-block size-1.5 rounded-full", ok ? "bg-edited" : "bg-muted-foreground/40")} />
      <span className={ok ? "text-foreground" : ""}>{ok ? label : label.replace("closed", "not closed").replace("present", "absent")}</span>
    </div>
  );
}
