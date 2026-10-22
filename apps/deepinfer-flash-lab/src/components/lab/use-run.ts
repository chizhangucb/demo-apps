"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ModeInfo } from "@/lib/mode";
import { computeRunMetrics, estimateTokens, windowRate, type RunMetrics } from "@/lib/metrics";
import { createSSEParser } from "@/lib/sse";

type LabEvent =
  | { type: "meta"; info: ModeInfo; sample: boolean; note?: string }
  | { type: "delta"; kind: "reasoning" | "content"; text: string }
  | { type: "usage"; completionTokens: number }
  | { type: "error"; message: string }
  | { type: "done" };

export type RunRecord = {
  at: number;
  label: string;
  sample: boolean;
  prompt: string;
  metrics: RunMetrics;
};

export type RunState = {
  status: "idle" | "running" | "done" | "error";
  info: ModeInfo | null;
  sample: boolean;
  note: string | null;
  reasoning: string;
  content: string;
  liveRate: number | null;
  liveTtft: number | null;
  liveElapsed: number;
  liveTokens: number;
  spark: number[];
  metrics: RunMetrics | null;
  error: string | null;
};

const EMPTY: RunState = {
  status: "idle",
  info: null,
  sample: false,
  note: null,
  reasoning: "",
  content: "",
  liveRate: null,
  liveTtft: null,
  liveElapsed: 0,
  liveTokens: 0,
  spark: [],
  metrics: null,
  error: null,
};

const HISTORY_KEY = "deepinfer-flash-lab:history";

function loadHistory(): RunRecord[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as RunRecord[];
  } catch {
    return [];
  }
}

export function useRun() {
  const [state, setState] = useState<RunState>(EMPTY);
  const [history, setHistory] = useState<RunRecord[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
    setHistory(loadHistory());
  }, []);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const run = useCallback(async (input: { prompt: string; presetId?: string; thinking: boolean }) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const start = performance.now();
    let first: number | null = null;
    let usage: number | null = null;
    let text = "";
    let tokens = 0;
    const marks: { t: number; n: number }[] = [];
    const spark: number[] = [];
    let meta: { info: ModeInfo | null; sample: boolean; note: string | null } = { info: null, sample: false, note: null };
    let reasoning = "";
    let content = "";
    let error: string | null = null;

    setState({ ...EMPTY, status: "running" });

    const tick = setInterval(() => {
      const now = performance.now();
      const rate = first === null ? null : windowRate(marks, now, 600);
      if (rate !== null) spark.push(rate);
      setState((s) => ({
        ...s,
        liveRate: rate,
        liveElapsed: now - start,
        liveTtft: first === null ? null : first - start,
        liveTokens: tokens,
        spark: [...spark],
        reasoning,
        content,
      }));
    }, 100);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      const parser = createSSEParser();
      for (;;) {
        const { value, done } = await reader.read();
        for (const data of done ? parser.flush() : parser.push(value)) {
          const ev = JSON.parse(data) as LabEvent;
          if (ev.type === "meta") {
            meta = { info: ev.info, sample: ev.sample, note: ev.note ?? null };
            setState((s) => ({ ...s, ...meta }));
          } else if (ev.type === "delta") {
            const now = performance.now();
            if (first === null) first = now;
            const n = meta.sample ? 1 : estimateTokens(ev.text);
            tokens += n;
            marks.push({ t: now, n });
            text += ev.text;
            if (ev.kind === "reasoning") reasoning += ev.text;
            else content += ev.text;
          } else if (ev.type === "usage") {
            usage = ev.completionTokens;
          } else if (ev.type === "error") {
            error = ev.message;
          }
        }
        if (done) break;
      }
    } catch (err) {
      if (!ctrl.signal.aborted) error = err instanceof Error ? err.message : String(err);
      else error = "Stopped by user.";
    } finally {
      clearInterval(tick);
    }

    const end = performance.now();
    const metrics = computeRunMetrics({ startMs: start, firstTokenMs: first, endMs: end, usageTokens: usage, text });
    setState((s) => ({
      ...s,
      ...meta,
      status: error && first === null ? "error" : "done",
      error,
      reasoning,
      content,
      liveRate: null,
      liveTokens: metrics.tokens,
      liveElapsed: metrics.totalMs,
      liveTtft: metrics.ttftMs,
      metrics,
      spark: [...spark],
    }));
    if (first !== null && meta.info) {
      const rec: RunRecord = { at: Date.now(), label: meta.info.label, sample: meta.sample, prompt: input.prompt.slice(0, 60), metrics };
      setHistory((h) => {
        const next = [rec, ...h].slice(0, 10);
        try {
          localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  }, []);

  return { state, history, run, stop };
}
