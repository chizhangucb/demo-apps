"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "cn";
import { VERIFY_TABLE } from "../../../data/benchmarks";
import { fmt, Panel, SimTag, Src } from "./bits";

const WORDS = "the scheduler overlaps CPU planning with GPU work so draft tokens arrive while the target model verifies the previous step and the accelerator never waits".split(" ");
const DRAFT = 5;
// Illustrative cost model: verifying k draft tokens costs 1 + COST * k units.
const COST = 0.18;
const PHASES = ["draft", "sort", "select", "verify"] as const;
type Phase = (typeof PHASES)[number];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

type Step = {
  tokens: string[];
  conf: number[]; // simulated per-token confidence
  cum: number[]; // expected acceptance of each prefix position
  pick: number; // tokens sent to verification
  accepted: number;
};

// Builds one simulated decode step. Confidences and draws are random.
export function simulateStep(seed: number, dynamic: boolean): Step {
  const r = rng(seed);
  const start = Math.floor(r() * (WORDS.length - DRAFT));
  const tokens = WORDS.slice(start, start + DRAFT);
  const conf = tokens.map((_, i) => Math.max(0.2, Math.min(0.98, 0.95 - i * 0.1 - r() * 0.3)));
  const cum: number[] = [];
  conf.reduce((acc, c, i) => (cum[i] = acc * c), 1);
  let pick = DRAFT;
  if (dynamic) {
    let best = -1;
    let expected = 0;
    for (let k = 1; k <= DRAFT; k++) {
      expected += cum[k - 1];
      const rate = (1 + expected) / (1 + COST * k);
      if (rate > best) {
        best = rate;
        pick = k;
      }
    }
  }
  let accepted = 0;
  while (accepted < pick && r() < conf[accepted]) accepted++;
  return { tokens, conf, cum, pick, accepted };
}

export function DecodeSim() {
  const [dynamic, setDynamic] = useState(true);
  const [tick, setTick] = useState(0);
  const [concIdx, setConcIdx] = useState(3);
  const [totals, setTotals] = useState({ steps: 0, verified: 0, accepted: 0 });

  const stepNo = Math.floor(tick / PHASES.length);
  const phase: Phase = PHASES[tick % PHASES.length];
  const step = useMemo(() => simulateStep(stepNo * 7919 + 13, dynamic), [stepNo, dynamic]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 900);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (phase === "verify") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- tally once per completed simulated step
      setTotals((t) => ({ steps: t.steps + 1, verified: t.verified + step.pick, accepted: t.accepted + step.accepted }));
    }
  }, [phase, step]);

  const row = VERIFY_TABLE[concIdx];
  const showSorted = phase !== "draft";
  const showPick = phase === "select" || phase === "verify";
  const showVerdict = phase === "verify";

  return (
    <Panel
      channel="CH.04"
      title="DSpark decode step"
      tag={<SimTag />}
      right={
        <div className="flex border border-border font-mono text-[10px]">
          {[true, false].map((d) => (
            <button
              key={String(d)}
              onClick={() => {
                setDynamic(d);
                setTotals({ steps: 0, verified: 0, accepted: 0 });
              }}
              className={cn("px-2 py-1", dynamic === d ? "bg-sim/15 text-sim" : "text-muted-foreground")}
            >
              {d ? "DYNAMIC" : "FIXED-5"}
            </button>
          ))}
        </div>
      }
    >
      <p className="mb-3 font-mono text-[10.5px] text-muted-foreground">
        Draft model proposes up to 5 tokens <Src k="readme" />. A Confidence Head scores each one; the scheduler sorts by expected acceptance and
        verifies the prefix that maximizes effective throughput <Src k="qa" />. Confidences, draws and the cost model below are simulated.
      </p>

      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] tracking-[0.16em]">
        {PHASES.map((p, i) => (
          <span key={p} className={cn("border px-1.5 py-0.5", p === phase ? "border-sim/70 bg-sim/15 text-sim" : "border-border text-muted-foreground")}>
            {i + 1}. {p.toUpperCase()}
          </span>
        ))}
        <span className="ml-auto text-muted-foreground">step {stepNo + 1}</span>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {step.tokens.map((tok, i) => {
          const picked = i < step.pick;
          const verdict = !showVerdict || !picked ? null : i < step.accepted ? "ok" : i === step.accepted ? "no" : "drop";
          const bar = showSorted ? step.cum[i] : step.conf[i];
          return (
            <div
              key={`${stepNo}-${i}`}
              className={cn(
                "flex flex-col gap-1.5 border p-2 transition-all duration-500 animate-in fade-in slide-in-from-bottom-1",
                showPick && !picked && "opacity-30",
                showPick && picked && !verdict && "border-sim/60 shadow-[0_0_14px_rgba(255,95,210,0.25)]",
                verdict === "ok" && "border-pass/70 bg-pass/10",
                verdict === "no" && "border-fail/70 bg-fail/10",
                verdict === "drop" && "border-border opacity-40",
                !showPick && "border-border",
              )}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="font-mono text-[10px] text-muted-foreground">d{i + 1}</span>
              <span className="truncate font-mono text-[13px] text-foreground">{tok}</span>
              <div className="h-1.5 w-full bg-white/5">
                <div className="h-full bg-sim shadow-[0_0_8px_rgba(255,95,210,0.7)] transition-all duration-500" style={{ width: `${bar * 100}%` }} />
              </div>
              <span className="font-mono text-[10px] tabular-nums text-sim/90">
                {showSorted ? "E[acc]" : "conf"} {fmt(bar, 2)}
              </span>
              <span className="h-3 font-mono text-[10px]">
                {verdict === "ok" && <span className="text-pass">accept</span>}
                {verdict === "no" && <span className="text-fail">reject</span>}
                {verdict === "drop" && <span className="text-muted-foreground">discard</span>}
                {showPick && !picked && <span className="text-muted-foreground">not verified</span>}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px]">
        <Stat label="simulated steps" value={fmt(totals.steps)} />
        <Stat label="sim avg verified" value={fmt(totals.steps ? totals.verified / totals.steps : null, 2)} />
        <Stat label="sim avg accepted" value={fmt(totals.steps ? totals.accepted / totals.steps : null, 2)} />
      </div>

      {/* Published numbers */}
      <div className="mt-4 border border-cyan-glow/30 bg-cyan-glow/[0.03] p-3">
        <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] tracking-[0.14em] text-cyan-glow">
          PUBLISHED: FIXED-5 VS DYNAMIC (EP64/DP64) <Src k="qa" />
          <span className="ml-auto text-muted-foreground">concurrency</span>
          <input
            type="range"
            min={0}
            max={VERIFY_TABLE.length - 1}
            value={concIdx}
            onChange={(e) => setConcIdx(Number(e.target.value))}
            className="w-32 accent-cyan-400"
            aria-label="concurrency per rank"
          />
          <span className="w-24 text-right whitespace-nowrap text-foreground">{row.concurrency} seqs/rank</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Pub label="avg verified" a={fmt(row.fixedVerified, 2)} b={fmt(row.dynamicVerified, 2)} src={row.source} />
          <Pub label="avg accepted" a={fmt(row.fixedAccepted, 2)} b={fmt(row.dynamicAccepted, 2)} src={row.source} />
          <Pub label="est. tok/s/rank" a={fmt(row.fixedTokPerSec)} b={fmt(row.dynamicTokPerSec)} src={row.source} />
          <div className="border border-border bg-black/30 px-2 py-1.5">
            <div className="text-[10px] text-muted-foreground">gain</div>
            <div className={cn("font-mono text-xl font-semibold glow-cyan", row.gain.startsWith("-") ? "text-fail" : "text-pass")}>{row.gain}</div>
            <Src href={row.source} label="Q&A table" />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-sim/30 bg-sim/[0.04] px-2 py-1.5">
      <div className="text-[10px] text-sim/80">{label}</div>
      <div className="text-base text-sim tabular-nums">{value}</div>
    </div>
  );
}

function Pub({ label, a, b, src }: { label: string; a: string; b: string; src: string }) {
  return (
    <div className="border border-border bg-black/30 px-2 py-1.5 font-mono">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-[13px] tabular-nums">
        <span className="text-muted-foreground">fixed </span>
        <span className="text-foreground">{a}</span>
      </div>
      <div className="text-[13px] tabular-nums">
        <span className="text-muted-foreground">dyn </span>
        <span className="text-cyan-glow glow-cyan">{b}</span>
      </div>
      <Src href={src} label="Q&A table" />
    </div>
  );
}
