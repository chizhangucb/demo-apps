"use client";

import type { FieldRow } from "@/lib/report";
import type { Fact } from "@/lib/types";
import { SourceTag, stamp } from "./source-tag";

const W = 760;
const LABEL = 210;
const RIGHT = 20;
const ROW = 36;
const TOP = 26;

function niceTicks(lo: number, hi: number, n = 6) {
  const span = hi - lo;
  const step0 = span / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) out.push(t);
  return out;
}

export function FootballField({ rows, price, priceFact }: { rows: FieldRow[]; price: number | null; priceFact: Fact }) {
  const vals = rows.flatMap((r) => [r.low, r.high]).filter((x): x is number => x !== null);
  if (price !== null) vals.push(price);
  const min = Math.min(...vals);
  const lo = min < 0 ? min * 1.1 : Math.max(0, min * 0.9);
  const hi = Math.max(...vals) * 1.05;
  const x = (v: number) => LABEL + ((v - lo) / (hi - lo)) * (W - LABEL - RIGHT);
  const H = TOP + rows.length * ROW + 30;
  const ticks = niceTicks(lo, hi);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber">Football field, $ per share</h2>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-0.5 bg-amber" /> price
          </span>
          <SourceTag fact={priceFact} />
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Football field chart of valuation ranges with the current price marked">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={TOP - 6} y2={H - 26} className="stroke-grid" strokeWidth={1} />
            <text x={x(t)} y={H - 12} textAnchor="middle" className="num fill-muted-foreground" fontSize={10}>
              ${t.toFixed(Math.abs(t) < 10 ? 1 : 0)}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y = TOP + i * ROW;
          const has = r.low !== null && r.high !== null;
          const fill = r.kind === "composite" ? "fill-amber/80" : r.kind === "market" ? "fill-muted-foreground/35" : "fill-cyan/45";
          return (
            <g key={r.id}>
              {r.kind === "composite" && <rect x={0} y={y - 4} width={W} height={ROW} className="fill-amber/5" />}
              <text x={8} y={y + 13} fontSize={11} className={r.kind === "composite" ? "fill-amber font-semibold" : "fill-foreground"}>
                {r.method}
              </text>
              {has ? (
                <>
                  <rect x={x(r.low!)} y={y + 2} width={Math.max(2, x(r.high!) - x(r.low!))} height={ROW - 12} className={fill} />
                  {r.mid !== null && <rect x={x(r.mid) - 1} y={y} width={2} height={ROW - 8} className="fill-foreground" />}
                  <text x={x(r.low!) - 4} y={y + 13} textAnchor="end" fontSize={10} className="num fill-muted-foreground">
                    {r.low!.toFixed(1)}
                  </text>
                  <text x={x(r.high!) + 4} y={y + 13} fontSize={10} className="num fill-muted-foreground">
                    {r.high!.toFixed(1)}
                  </text>
                </>
              ) : (
                <>
                  <rect x={LABEL} y={y + 2} width={W - LABEL - RIGHT} height={ROW - 12} className="fill-none stroke-down/50" strokeDasharray="4 4" />
                  <text x={LABEL + 10} y={y + 13} fontSize={10} className="num fill-down uppercase" letterSpacing={1}>
                    not obtained
                  </text>
                </>
              )}
            </g>
          );
        })}
        {price !== null && (
          <g>
            <line x1={x(price)} x2={x(price)} y1={TOP - 14} y2={H - 26} className="stroke-amber" strokeWidth={2} />
            <rect x={x(price) - 40} y={2} width={80} height={16} className="fill-amber" />
            <text x={x(price)} y={14} textAnchor="middle" fontSize={11} className="num fill-black font-semibold">
              PX ${price.toFixed(2)}
            </text>
          </g>
        )}
      </svg>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-1 text-[10px] text-muted-foreground">
        <span>Bars: method range. Tick: point estimate. Every method ran in dcf.py.</span>
        <span className="num">price as of {stamp(priceFact.asOf)}</span>
      </div>
    </div>
  );
}
