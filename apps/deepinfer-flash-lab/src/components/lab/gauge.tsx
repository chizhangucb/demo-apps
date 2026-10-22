"use client";

import { DECODE_POINTS } from "../../../data/benchmarks";

const MAX = 350;
const START = 135;
const SWEEP = 270;
const CX = 150;
const CY = 150;
const R = 118;

function polar(angleDeg: number, r = R) {
  const a = (angleDeg * Math.PI) / 180;
  return [Math.round((CX + r * Math.cos(a)) * 100) / 100, Math.round((CY + r * Math.sin(a)) * 100) / 100];
}

function arc(from: number, to: number, r = R) {
  const [x1, y1] = polar(from, r);
  const [x2, y2] = polar(to, r);
  const large = to - from > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

const angleOf = (v: number) => START + (SWEEP * Math.min(Math.max(v, 0), MAX)) / MAX;

export const PUBLISHED_MIN = Math.min(...DECODE_POINTS.map((p) => p.tokPerSecPerUser));
export const PUBLISHED_MAX = Math.max(...DECODE_POINTS.map((p) => p.tokPerSecPerUser));

// Radial tokens/s gauge. `value` is the needle (rolling rate while streaming,
// final decode rate after). The faint band marks DeepInfer's published
// per-user decode range read from the decode Pareto chart.
export function Gauge({ value, active, accent }: { value: number | null; active: boolean; accent: "cyan" | "amber" }) {
  const color = accent === "amber" ? "#ffb43a" : "#38e8ff";
  const v = value ?? 0;
  const needle = angleOf(v);
  const ticks = Array.from({ length: 8 }, (_, i) => i * 50);
  const minor = Array.from({ length: 36 }, (_, i) => i * 10);
  const [nx, ny] = polar(needle, R - 26);

  return (
    <svg viewBox="0 0 300 250" className="w-full max-w-[340px]" role="img" aria-label={`tokens per second gauge, ${Math.round(v)}`}>
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="face" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0d1a22" />
          <stop offset="100%" stopColor="#05090c" />
        </radialGradient>
      </defs>
      <circle cx={CX} cy={CY} r={R + 18} fill="url(#face)" stroke="#1a2a35" />
      <path d={arc(START, START + SWEEP)} stroke="#132029" strokeWidth={14} fill="none" />
      <path d={arc(angleOf(PUBLISHED_MIN), angleOf(PUBLISHED_MAX), R + 12)} stroke="#ffb43a" strokeOpacity={0.35} strokeWidth={3} fill="none" />
      {v > 0 && (
        <path
          d={arc(START, needle)}
          stroke={color}
          strokeWidth={14}
          fill="none"
          filter="url(#glow)"
          style={{ transition: "d 120ms linear" }}
        />
      )}
      {minor.map((t) => {
        const [x1, y1] = polar(angleOf(t), R - 11);
        const [x2, y2] = polar(angleOf(t), R - (t % 50 === 0 ? 20 : 15));
        return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2d4352" strokeWidth={t % 50 === 0 ? 2 : 1} />;
      })}
      {ticks.map((t) => {
        const [x, y] = polar(angleOf(t), R - 34);
        return (
          <text key={t} x={x} y={y + 3} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>
            {t}
          </text>
        );
      })}
      <line x1={CX} y1={CY} x2={nx} y2={ny} stroke={color} strokeWidth={2.5} filter="url(#glow)" style={{ transition: "all 120ms linear" }} />
      <circle cx={CX} cy={CY} r={7} fill="#05090c" stroke={color} strokeWidth={2} />
      <text x={CX} y={CY + 50} textAnchor="middle" fontSize={38} fontWeight={600} fill={color} filter="url(#glow)" className="font-mono tabular-nums">
        {value === null ? "--" : Math.round(v)}
      </text>
      <text x={CX} y={CY + 94} textAnchor="middle" fontSize={10} letterSpacing={2} className="fill-muted-foreground font-mono">
        {active ? "TOKENS / S  LIVE" : "TOKENS / S  DECODE"}
      </text>
    </svg>
  );
}

export function Sparkline({ values, accent }: { values: number[]; accent: "cyan" | "amber" }) {
  const color = accent === "amber" ? "#ffb43a" : "#38e8ff";
  const w = 300;
  const h = 48;
  const max = Math.max(50, ...values);
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-12 w-full" aria-label="tokens per second over the run">
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={0} x2={w} y1={h * f} y2={h * f} stroke="#13202a" />
      ))}
      {values.length > 1 && (
        <>
          <polyline points={`0,${h} ${pts.join(" ")} ${w},${h}`} fill={color} fillOpacity={0.08} stroke="none" />
          <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </>
      )}
    </svg>
  );
}
