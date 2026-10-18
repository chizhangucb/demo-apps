import { usd } from "@/lib/format";

const W = 440;
const H = 230;
const PAD = { l: 46, r: 8, t: 14, b: 10 };

function niceStep(range: number, count: number) {
  const raw = range / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}

/** Catmull-Rom through the points, as cubic Bezier segments. */
function smoothPath(pts: [number, number][]) {
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export function BalanceChart({ series, bars }: { series: number[]; bars: boolean[] }) {
  const lo = Math.min(...series);
  const hi = Math.max(...series);
  const step = niceStep(Math.max(hi - lo, 2), 4);
  const yMin = Math.floor(lo / step) * step;
  const yMax = Math.ceil((hi * 1.02) / step) * step;
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (i / Math.max(series.length - 1, 1)) * iw * 0.78;
  const y = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * ih;
  const pts = series.map((v, i) => [x(i), y(v)] as [number, number]);
  const line = smoothPath(pts);
  const end = pts[pts.length - 1];
  const hiIdx = series.indexOf(hi);
  const loIdx = series.indexOf(lo);
  const ticks: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += step) ticks.push(v);
  const last = series[series.length - 1];

  return (
    <div className="flex h-full flex-col">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Balance ${usd(last)}`}>
        <defs>
          <linearGradient id="bal-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#39ff88" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#39ff88" stopOpacity="0" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.06)" />
            <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" className="fill-[#6b7383] font-mono text-[9px]">
              ${step >= 1 ? v.toFixed(0) : v.toFixed(1)}
            </text>
          </g>
        ))}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PAD.l + f * iw}
            x2={PAD.l + f * iw}
            y1={PAD.t}
            y2={H - PAD.b}
            stroke="rgba(255,255,255,0.04)"
          />
        ))}
        <path d={`${line}L${end[0]},${H - PAD.b}L${pts[0][0]},${H - PAD.b}Z`} fill="url(#bal-fill)" />
        <path d={line} fill="none" stroke="#39ff88" strokeWidth="1.8" filter="url(#glow)" />
        {hiIdx < series.length - 8 && (
          <text
            x={pts[hiIdx][0]}
            y={pts[hiIdx][1] - 5}
            textAnchor="middle"
            className="fill-[#39ff88]/70 font-mono text-[8px]"
          >
            H {usd(hi)}
          </text>
        )}
        <text
          x={pts[loIdx][0]}
          y={Math.min(pts[loIdx][1] + 11, H - 2)}
          textAnchor="middle"
          className="fill-[#ff3b5c]/70 font-mono text-[8px]"
        >
          L {usd(lo)}
        </text>
        <circle
          cx={end[0]}
          cy={end[1]}
          r="6"
          fill="none"
          stroke="#39ff88"
          strokeOpacity="0.55"
          className="animate-ping-ring"
        />
        <circle cx={end[0]} cy={end[1]} r="3" fill="#04070d" stroke="#39ff88" strokeWidth="1.6" filter="url(#glow)" />
        <line x1={end[0]} x2={end[0] + 10} y1={end[1]} y2={end[1]} stroke="#39ff88" strokeOpacity="0.5" />
        <text
          x={end[0] + 12}
          y={Math.max(end[1] - 9, 18)}
          className="fill-[#8a93a6] font-mono text-[8px] tracking-widest"
        >
          BALANCE
        </text>
        <text
          x={end[0] + 12}
          y={Math.max(end[1] + 7, 34)}
          className="neon-green-svg fill-[#39ff88] font-mono text-[15px] font-bold"
        >
          {usd(last)}
        </text>
      </svg>
      <div className="mt-1 flex h-3.5 items-end gap-px pl-[10%]" aria-hidden>
        {bars.slice(-90).map((up, i) => (
          <span key={i} className={`w-full ${up ? "h-full bg-[#39ff88]/80" : "h-2/3 bg-[#ff3b5c]/80"}`} />
        ))}
      </div>
    </div>
  );
}
