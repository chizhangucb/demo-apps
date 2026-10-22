"use client";

import { useEffect, useRef, useState } from "react";
import { Cpu, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { ModeInfo } from "@/lib/mode";
import { cn } from "cn";
import { CHAT_PRESETS, SAMPLE_RECORDING } from "../../../data/samples/presets";
import { SOURCES } from "../../../data/benchmarks";
import { fmt, LiveTag, Panel, Readout, SampleTag, Src } from "./bits";
import { Gauge, PUBLISHED_MAX, PUBLISHED_MIN, Sparkline } from "./gauge";
import { useRun } from "./use-run";
import { StructuredPanel } from "./structured";
import { DecodeSim } from "./decode-sim";
import { SchedulerSim } from "./scheduler-sim";
import { Benchmarks } from "./benchmarks";
import { FeatureMap, HardwareNote } from "./features";

export function Lab() {
  const [mode, setMode] = useState<ModeInfo | null>(null);
  const [presetId, setPresetId] = useState<string | undefined>(CHAT_PRESETS[0].id);
  const [prompt, setPrompt] = useState(CHAT_PRESETS[0].prompt);
  const [thinking, setThinking] = useState(false);
  const { state, history, run, stop } = useRun();
  const autoRan = useRef(false);

  useEffect(() => {
    fetch("/api/mode")
      .then((r) => r.json())
      .then((m: ModeInfo) => setMode(m))
      .catch(() => setMode(null));
  }, []);

  // In SAMPLE mode, replay the first preset once so the gauge is alive on load.
  useEffect(() => {
    if (mode?.mode === "sample" && !autoRan.current) {
      autoRan.current = true;
      run({ prompt: CHAT_PRESETS[0].prompt, presetId: CHAT_PRESETS[0].id, thinking: false });
    }
  }, [mode, run]);

  const running = state.status === "running";
  const shownMode = state.info ?? mode;
  const isSample = state.info ? state.sample : mode?.mode === "sample";
  const accent = isSample ? "amber" : "cyan";
  const gaugeValue = running ? state.liveRate : (state.metrics?.tokensPerSec ?? null);
  const m = state.metrics;
  const lastTps = history[0]?.metrics.tokensPerSec ?? null;
  const measuredWhere = isSample ? "SAMPLE replay, measured in this browser" : "measured in this browser from the live stream";

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-16 sm:px-6">
      {/* Rack header */}
      <header className="sticky top-0 z-40 -mx-4 mb-5 border-b border-border bg-background/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center border border-cyan-glow/60 bg-cyan-glow/10 shadow-[0_0_16px_rgba(56,232,255,0.35)]">
              <Cpu className="size-4 text-cyan-glow" />
            </div>
            <div>
              <div className="font-mono text-sm font-bold tracking-[0.22em] text-foreground">
                DEEPINFER <span className="text-cyan-glow glow-cyan">{"//"}</span> FLASH LAB
              </div>
              <div className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
                DeepSeek-V4.1-Flash, seen from the outside of DeepInfer <Src k="repo" />
              </div>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3 font-mono text-[11px]">
            {shownMode ? (
              isSample ? (
                <SampleTag>SAMPLE</SampleTag>
              ) : (
                <LiveTag>{shownMode.label}</LiveTag>
              )
            ) : (
              <span className="text-muted-foreground">resolving mode...</span>
            )}
            <span className="text-muted-foreground">
              provider <span className="text-foreground">{shownMode?.provider ?? "--"}</span>
            </span>
            <span className="text-muted-foreground">
              model <span className="text-foreground">{shownMode?.model ?? "--"}</span>
            </span>
            <span className="hidden items-center gap-1.5 text-muted-foreground md:flex">
              <span className={cn("size-1.5 rounded-full", running ? "pulse-dot bg-pass" : "bg-muted-foreground/50")} />
              {running ? "STREAMING" : "STANDBY"}
            </span>
          </div>
        </div>
      </header>

      {/* CH.01 hero console: gauge cluster + stream terminal */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Panel
          channel="CH.01"
          title="Speed and latency"
          tag={isSample ? <SampleTag>SAMPLE REPLAY</SampleTag> : <LiveTag>MEASURED</LiveTag>}
          className="lg:col-span-5"
        >
          <div className="flex flex-col items-center">
            <Gauge value={gaugeValue} active={running} accent={accent} />
            <p className="mt-1 mb-3 text-center font-mono text-[10px] text-amber-glow/80">
              amber band: DeepInfer per-user decode {PUBLISHED_MIN} to {PUBLISHED_MAX} tok/s on 64 SM100 GPUs (approx., read from chart) <Src k="decodeChart" />
            </p>
            <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
              <Readout label="TTFT" value={fmt(state.liveTtft)} unit="ms" accent={accent} />
              <Readout
                label="Decode"
                value={fmt(running ? state.liveRate : m?.tokensPerSec, 1)}
                unit="tok/s"
                accent={accent}
                note={running ? "rolling 0.6 s" : m ? (m.tokensEstimated ? "tokens estimated" : "usage tokens") : undefined}
              />
              <Readout label="Total" value={fmt(state.liveElapsed)} unit="ms" accent={accent} />
              <Readout label="Tokens" value={fmt(state.liveTokens)} unit={m?.tokensEstimated ? "est." : ""} accent={accent} />
            </div>
            <div className="mt-3 w-full border border-border/80 bg-black/30 px-2 pt-1">
              <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>TOK/S OVER RUN</span>
                <span>{measuredWhere}</span>
              </div>
              <Sparkline values={state.spark} accent={accent} />
            </div>
            <RunHistory history={history} />
          </div>
        </Panel>

        <Panel
          channel="CH.02"
          title="Streaming playground"
          className="lg:col-span-7"
          right={<span className="font-mono text-[10px] text-muted-foreground">cap 800 tokens, 60 s timeout</span>}
        >
          <div className="flex h-full flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              {CHAT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPresetId(p.id);
                    setPrompt(p.prompt);
                  }}
                  className={cn(
                    "border px-2.5 py-1 font-mono text-[11px] transition",
                    presetId === p.id && prompt === p.prompt
                      ? "border-cyan-glow/70 bg-cyan-glow/10 text-cyan-glow shadow-[0_0_12px_rgba(56,232,255,0.25)]"
                      : "border-border text-muted-foreground hover:border-cyan-glow/40 hover:text-foreground",
                  )}
                >
                  {p.title}
                </button>
              ))}
            </div>
            <div className="flex items-stretch gap-2 border border-border bg-black/40 p-2">
              <span className="pt-1 font-mono text-sm text-cyan-glow glow-cyan">&gt;</span>
              <textarea
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                }}
                rows={2}
                className="flex-1 resize-none bg-transparent font-mono text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
                placeholder="Ask DeepSeek-V4.1-Flash something"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                <Switch checked={thinking} onCheckedChange={(v) => setThinking(v)} />
                thinking {thinking ? "on" : "off"}
              </label>
              {isSample && mode?.mode === "sample" && !CHAT_PRESETS.some((p) => p.prompt === prompt) && (
                <span className="font-mono text-[10px] text-amber-glow">custom prompts need a key; SAMPLE replays a preset</span>
              )}
              <div className="ml-auto flex gap-2">
                {running ? (
                  <Button variant="destructive" size="sm" onClick={stop} className="font-mono tracking-wider">
                    <Square /> STOP
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => run({ prompt, presetId, thinking })}
                    disabled={!prompt.trim()}
                    className="font-mono tracking-wider shadow-[0_0_16px_rgba(56,232,255,0.4)]"
                  >
                    <Play /> RUN
                  </Button>
                )}
              </div>
            </div>
            {state.note && <div className="border border-amber-glow/40 bg-amber-glow/5 px-3 py-1.5 font-mono text-[11px] text-amber-glow">{state.note}</div>}
            {state.error && <div className="border border-fail/40 bg-fail/5 px-3 py-1.5 font-mono text-[11px] text-fail">{state.error}</div>}
            <div className="relative min-h-[300px] flex-1 overflow-auto border border-border bg-[#03070a] p-3 font-mono text-[12.5px] leading-relaxed lg:max-h-[440px]">
              <div className="mb-2 flex items-center justify-between text-[10px] tracking-[0.16em] text-muted-foreground">
                <span>STREAM OUTPUT</span>
                {isSample && <span className="text-amber-glow">SAMPLE: {SAMPLE_RECORDING}, replayed at its recorded pace</span>}
              </div>
              {state.reasoning && (
                <div className="mb-3 border-l-2 border-sim/50 pl-3 text-[12px] text-muted-foreground">
                  <div className="mb-1 text-[10px] tracking-[0.16em] text-sim/80">REASONING (delta.reasoning_content)</div>
                  <span className="whitespace-pre-wrap">{state.reasoning}</span>
                </div>
              )}
              <div className={cn("whitespace-pre-wrap text-foreground", running && "caret")}>{state.content}</div>
              {!state.content && !state.reasoning && !running && (
                <div className="text-muted-foreground">Pick a preset and press RUN. The gauge measures the stream as it arrives.</div>
              )}
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <StructuredPanel sampleMode={mode?.mode === "sample"} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <DecodeSim />
        <SchedulerSim />
      </div>

      <div className="mt-4">
        <Benchmarks yourTps={lastTps} yourTpsSample={history[0]?.sample ?? true} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <FeatureMap className="lg:col-span-8" />
        <HardwareNote className="lg:col-span-4" />
      </div>

      <footer className="mt-8 border-t border-border pt-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
        Built around{" "}
        <a className="text-cyan-glow underline" href={SOURCES.repo.url} target="_blank" rel="noreferrer">
          deepseek-ai/DeepInfer
        </a>{" "}
        by DeepSeek-AI, Apache License 2.0. Chart data and original chart images come from that repository. Announcement <Src k="bookmark" />. API
        reference <Src k="api" />. LIVE numbers are measured in your browser; SAMPLE replays responses {SAMPLE_RECORDING}; SIMULATION panels are illustrative
        animations, not measurements.
      </footer>
    </div>
  );
}

function RunHistory({ history }: { history: ReturnType<typeof useRun>["history"] }) {
  if (!history.length) return null;
  return (
    <div className="mt-3 w-full">
      <div className="mb-1 font-mono text-[10px] tracking-[0.16em] text-muted-foreground">RUN LOG (last 10, this browser)</div>
      <div className="max-h-28 overflow-auto border border-border/80">
        <table className="w-full font-mono text-[10.5px] tabular-nums">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border/80">
              <th className="px-2 py-1 text-left font-normal">mode</th>
              <th className="px-2 py-1 text-right font-normal">ttft ms</th>
              <th className="px-2 py-1 text-right font-normal">tok/s</th>
              <th className="px-2 py-1 text-right font-normal">total ms</th>
              <th className="px-2 py-1 text-right font-normal">tokens</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.at} className="border-b border-border/40 last:border-0">
                <td className={cn("px-2 py-0.5", h.sample ? "text-amber-glow" : "text-pass")}>{h.sample ? "SAMPLE" : h.label}</td>
                <td className="px-2 py-0.5 text-right">{fmt(h.metrics.ttftMs)}</td>
                <td className="px-2 py-0.5 text-right">{fmt(h.metrics.tokensPerSec, 1)}</td>
                <td className="px-2 py-0.5 text-right">{fmt(h.metrics.totalMs)}</td>
                <td className="px-2 py-0.5 text-right">
                  {fmt(h.metrics.tokens)}
                  {h.metrics.tokensEstimated ? "*" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
