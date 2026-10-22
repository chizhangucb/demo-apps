"use client";

import { useState } from "react";
import { cn } from "cn";
import {
  BENCH_NOTE,
  DECODE_POINTS,
  DECODE_SUBTITLE,
  EVAL_RESULTS,
  HEADLINE_FACTS,
  ORIGINAL_CHART_IMAGES,
  PREFILL_POINTS,
  PREFILL_SUBTITLE,
  PRICING,
  VERIFY_TABLE,
  type Fact,
} from "../../../data/benchmarks";
import { fmt, Panel, Src } from "./bits";

type Pt = { x: number; y: number; label: string; source: string };

function ParetoChart({
  points,
  xMax,
  yMax,
  xLabel,
  yLabel,
  pointLabel,
  marker,
}: {
  points: Pt[];
  xMax: number;
  yMax: number;
  xLabel: string;
  yLabel: string;
  pointLabel: string;
  marker?: { x: number; label: string } | null;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560;
  const H = 300;
  const m = { l: 62, r: 16, t: 14, b: 40 };
  const sx = (x: number) => m.l + (x / xMax) * (W - m.l - m.r);
  const sy = (y: number) => H - m.b - (y / yMax) * (H - m.t - m.b);
  const xt = Array.from({ length: 6 }, (_, i) => (xMax / 5) * i);
  const yt = Array.from({ length: 5 }, (_, i) => (yMax / 4) * i);
  const path = points.map((p, i) => `${i ? "L" : "M"} ${sx(p.x)} ${sy(p.y)}`).join(" ");
  const h = hover !== null ? points[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseLeave={() => setHover(null)}>
        <defs>
          <filter id="cglow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {yt.map((y) => (
          <g key={y}>
            <line x1={m.l} x2={W - m.r} y1={sy(y)} y2={sy(y)} stroke="#13202a" />
            <text x={m.l - 8} y={sy(y) + 3} textAnchor="end" fontSize={10} className="fill-muted-foreground font-mono">
              {fmt(y)}
            </text>
          </g>
        ))}
        {xt.map((x) => (
          <g key={x}>
            <line x1={sx(x)} x2={sx(x)} y1={m.t} y2={H - m.b} stroke="#0f1a22" />
            <text x={sx(x)} y={H - m.b + 14} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
              {fmt(x)}
            </text>
          </g>
        ))}
        <text x={(W + m.l) / 2} y={H - 6} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
          {xLabel}
        </text>
        <text x={12} y={(H - m.b) / 2} textAnchor="middle" fontSize={10} transform={`rotate(-90 12 ${(H - m.b) / 2})`} className="fill-muted-foreground font-mono">
          {yLabel}
        </text>
        {marker && (
          <g>
            <line x1={sx(Math.min(marker.x, xMax))} x2={sx(Math.min(marker.x, xMax))} y1={m.t} y2={H - m.b} stroke="#ffb43a" strokeDasharray="4 4" strokeWidth={1.5} />
            <text x={sx(Math.min(marker.x, xMax)) + 5} y={m.t + 12} fontSize={10} fill="#ffb43a" className="font-mono">
              {marker.label}
            </text>
          </g>
        )}
        <path d={path} fill="none" stroke="#38e8ff" strokeWidth={2} filter="url(#cglow)" />
        {points.map((p, i) => (
          <g key={p.label} onMouseEnter={() => setHover(i)} className="cursor-crosshair">
            <circle cx={sx(p.x)} cy={sy(p.y)} r={14} fill="transparent" />
            <circle cx={sx(p.x)} cy={sy(p.y)} r={hover === i ? 6 : 4.5} fill="#05080b" stroke="#38e8ff" strokeWidth={2} />
            <text x={sx(p.x)} y={sy(p.y) - 10} textAnchor="middle" fontSize={9.5} className="fill-foreground font-mono">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute z-10 border border-cyan-glow/50 bg-popover/95 px-2.5 py-1.5 font-mono text-[11px] shadow-[0_0_16px_rgba(56,232,255,0.25)]"
          style={{ left: `${(sx(h.x) / W) * 100}%`, top: `${(sy(h.y) / H) * 100}%`, transform: "translate(-50%, calc(-100% - 14px))" }}
        >
          <div className="text-cyan-glow">
            {pointLabel} {h.label}
          </div>
          <div>
            {xLabel.split(" (")[0]}: {fmt(h.x)}
          </div>
          <div>
            {yLabel.split(" (")[0]}: {fmt(h.y)}
          </div>
          <div className="text-[10px] text-amber-glow">approx., read from chart</div>
        </div>
      )}
    </div>
  );
}

function ChartBlock({
  title,
  subtitle,
  srcKey,
  image,
  children,
  rows,
}: {
  title: string;
  subtitle: string;
  srcKey: "decodeChart" | "prefillChart";
  image: string;
  children: React.ReactNode;
  rows: { cells: string[]; source: string }[];
}) {
  const [original, setOriginal] = useState(false);
  return (
    <div className="border border-border bg-[#03070a] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-mono text-[12px] font-semibold tracking-[0.14em] text-foreground">{title}</h3>
        <Src k={srcKey} />
        <button
          onClick={() => setOriginal((o) => !o)}
          className="ml-auto border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-cyan-glow"
        >
          {original ? "interactive redraw" : "view original chart"}
        </button>
      </div>
      <div className="mt-1 font-mono text-[10px] text-cyan-glow/80">{subtitle}</div>
      <div className="mt-2">
        {original ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote upstream image, shown as-is
          <img src={image} alt={`${title}, original from deepseek-ai/DeepInfer (Apache-2.0)`} className="w-full bg-white" />
        ) : (
          children
        )}
      </div>
      {original && <div className="mt-1 font-mono text-[10px] text-muted-foreground">Image: deepseek-ai/DeepInfer, Apache-2.0.</div>}
      <table className="mt-2 w-full font-mono text-[10.5px] tabular-nums">
        <tbody>
          {rows.map((r) => (
            <tr key={r.cells[0]} className="border-t border-border/50">
              {r.cells.map((c, i) => (
                <td key={i} className={cn("px-1.5 py-0.5", i ? "text-right" : "text-muted-foreground")}>
                  {c}
                </td>
              ))}
              <td className="px-1.5 py-0.5 text-right">
                <Src href={r.source} label="approx." />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Benchmarks({ yourTps, yourTpsSample }: { yourTps: number | null; yourTpsSample: boolean }) {
  return (
    <Panel
      channel="CH.06"
      title="Published benchmarks"
      right={<span className="font-mono text-[10px] text-muted-foreground">{BENCH_NOTE} <Src k="readme" /></span>}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartBlock
          title="DECODE PARETO"
          subtitle={DECODE_SUBTITLE}
          srcKey="decodeChart"
          image={ORIGINAL_CHART_IMAGES.decode}
          rows={DECODE_POINTS.map((p) => ({
            cells: [`${p.reqs} reqs/DP rank`, `${fmt(p.tokPerSecPerUser)} tok/s/user`, `${fmt(p.tokPerSecPerGpu)} tok/s/GPU`],
            source: p.source,
          }))}
        >
          <ParetoChart
            points={DECODE_POINTS.map((p) => ({ x: p.tokPerSecPerUser, y: p.tokPerSecPerGpu, label: String(p.reqs), source: p.source }))}
            xMax={350}
            yMax={30000}
            xLabel="per-user speed (tokens/s/user)"
            yLabel="output throughput (tokens/s/GPU)"
            pointLabel="decode_num_requests"
            marker={yourTps ? { x: yourTps, label: `your last run${yourTpsSample ? " (SAMPLE)" : ""}: ${fmt(yourTps, 1)} tok/s` } : null}
          />
          <p className="mt-1 font-mono text-[10px] leading-snug text-amber-glow/90">
            Measured here vs published: the dashed line is your last run, measured in this browser
            {yourTpsSample ? " from a SAMPLE replay" : ""}. It went over the internet to a hosted API, not to a DeepInfer cluster, so it is a reference
            point, not a like-for-like comparison.
          </p>
        </ChartBlock>
        <ChartBlock
          title="PREFILL PARETO"
          subtitle={PREFILL_SUBTITLE}
          srcKey="prefillChart"
          image={ORIGINAL_CHART_IMAGES.prefill}
          rows={PREFILL_POINTS.map((p) => ({
            cells: [`${fmt(p.batchTokens)} tok batch/DP rank`, `${fmt(p.latencyMs)} ms/step`, `${fmt(p.tokPerSecPerGpu)} tok/s/GPU`],
            source: p.source,
          }))}
        >
          <ParetoChart
            points={PREFILL_POINTS.map((p) => ({ x: p.latencyMs, y: p.tokPerSecPerGpu, label: fmt(p.batchTokens), source: p.source }))}
            xMax={800}
            yMax={100000}
            xLabel="latency (ms per prefill step)"
            yLabel="non-cached input (tokens/s/GPU)"
            pointLabel="prefill_batch_size"
          />
        </ChartBlock>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <div className="border border-border bg-[#03070a] p-3 lg:col-span-7">
          <div className="mb-2 flex items-center gap-2 font-mono text-[12px] font-semibold tracking-[0.14em]">
            DYNAMIC VS FIXED-5 VERIFICATION <Src k="qa" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-[11px] tabular-nums">
              <thead className="text-[10px] text-muted-foreground">
                <tr className="border-b border-border">
                  {["seqs/rank", "verified fixed", "verified dyn", "accepted fixed", "accepted dyn", "tok/s fixed", "tok/s dyn", "gain", ""].map((h) => (
                    <th key={h} className="px-1.5 py-1 text-right font-normal first:text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {VERIFY_TABLE.map((r) => (
                  <tr key={r.concurrency} className="border-b border-border/40">
                    <td className="px-1.5 py-1 text-cyan-glow">{r.concurrency}</td>
                    <td className="px-1.5 py-1 text-right">{fmt(r.fixedVerified)}</td>
                    <td className="px-1.5 py-1 text-right">{r.dynamicVerified}</td>
                    <td className="px-1.5 py-1 text-right">{r.fixedAccepted}</td>
                    <td className="px-1.5 py-1 text-right">{r.dynamicAccepted}</td>
                    <td className="px-1.5 py-1 text-right">{fmt(r.fixedTokPerSec)}</td>
                    <td className="px-1.5 py-1 text-right">{fmt(r.dynamicTokPerSec)}</td>
                    <td className={cn("px-1.5 py-1 text-right", r.gain.startsWith("-") ? "text-fail" : "text-pass")}>{r.gain}</td>
                    <td className="px-1.5 py-1 text-right">
                      <Src href={r.source} label="Q&A" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="grid content-start gap-3 lg:col-span-5">
          <FactGrid title="AT SCALE" facts={HEADLINE_FACTS} />
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <FactGrid title="EVAL PASS@1, V4.1 DEFAULT CONFIG (indicative rather than exact)" facts={EVAL_RESULTS} />
        <FactGrid title="HOSTED API PRICING, deepseek-flash" facts={PRICING} />
      </div>
    </Panel>
  );
}

function FactGrid({ title, facts }: { title: string; facts: Fact[] }) {
  return (
    <div className="border border-border bg-[#03070a] p-3">
      <div className="mb-2 font-mono text-[10px] tracking-[0.14em] text-muted-foreground">{title}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
        {facts.map((f) => (
          <div key={f.label} className="border border-border/70 bg-black/30 px-2 py-1.5">
            <div className="font-mono text-[10px] text-muted-foreground">{f.label}</div>
            <div className="font-mono text-lg font-semibold text-cyan-glow glow-cyan tabular-nums">{f.value}</div>
            {f.detail && <div className="font-mono text-[9.5px] text-muted-foreground">{f.detail}</div>}
            <Src href={f.source} label={f.source.includes("pricing") ? "pricing" : f.source.includes("eval") ? "eval README" : f.source.includes("qa") ? "Q&A doc" : "README"} />
          </div>
        ))}
      </div>
    </div>
  );
}
