"use client";

import { MACHINE_INFO, AGENT, type Host } from "@/lib/setup";
import type { PacketView, View } from "@/lib/view";

const POS: Record<Host, { x: number; y: number }> = {
  cloud: { x: 110, y: 70 },
  "home-mac": { x: 330, y: 215 },
  "tokyo-server": { x: 550, y: 70 },
};
const EDGES: [Host, Host][] = [
  ["cloud", "home-mac"],
  ["home-mac", "tokyo-server"],
  ["cloud", "tokyo-server"],
];

function Packet({ p }: { p: PacketView }) {
  const a = POS[p.from];
  const b = POS[p.to];
  const refused = p.status >= 400;
  const color = refused ? "#dc2626" : p.reply ? "#16a34a" : "#2563eb";
  const nx = a.x + (b.x - a.x) * 0.82;
  const ny = a.y + (b.y - a.y) * 0.82;
  const xs = refused ? `${a.x};${nx};${a.x}` : `${a.x};${b.x}`;
  const ys = refused ? `${a.y};${ny};${a.y}` : `${a.y};${b.y}`;
  const kt = refused ? "0;0.55;1" : "0;1";
  return (
    <g key={p.index}>
      <circle r={9} fill={color} opacity={0.9}>
        <animate attributeName="cx" values={xs} keyTimes={kt} dur="1.2s" fill="freeze" />
        <animate attributeName="cy" values={ys} keyTimes={kt} dur="1.2s" fill="freeze" />
        {refused && <animate attributeName="opacity" values="0.9;0.9;0" keyTimes="0;0.85;1" dur="1.4s" fill="freeze" />}
      </circle>
      <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 12} textAnchor="middle" className="fill-foreground text-[11px] font-medium">
        {p.label} {refused ? `(${p.status} refused)` : `(${p.status})`}
      </text>
    </g>
  );
}

export function Network({ view, live }: { view: View; live: boolean }) {
  const last = view.packets[view.packets.length - 1];
  const route = view.done?.route;
  return (
    <svg viewBox="0 0 660 290" className="w-full h-auto" role="img" aria-label="Simulated tailnet with three machines">
      <defs>
        <pattern id="grid" width="22" height="22" patternUnits="userSpaceOnUse">
          <path d="M 22 0 L 0 0 0 22" fill="none" className="stroke-border" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width="660" height="290" fill="url(#grid)" rx="10" />
      <text x="12" y="20" className="fill-muted-foreground text-[11px]">simulated tailnet: example-tail.ts.net (no real machines)</text>
      {EDGES.map(([a, b]) => {
        const active = last && ((last.from === a && last.to === b) || (last.from === b && last.to === a));
        return (
          <line
            key={a + b}
            x1={POS[a].x} y1={POS[a].y} x2={POS[b].x} y2={POS[b].y}
            className={active ? (last.status >= 400 ? "stroke-red-500" : "stroke-blue-500") : "stroke-muted-foreground/40"}
            strokeWidth={active ? 2.5 : 1.5}
            strokeDasharray="6 5"
          />
        );
      })}
      {route &&
        route.slice(1).map((h, i) => (
          <line
            key={`r${i}`}
            x1={POS[route[i]].x} y1={POS[route[i]].y} x2={POS[h].x} y2={POS[h].y}
            stroke="#16a34a" strokeWidth={7} strokeLinecap="round" opacity={0.45}
          />
        ))}
      {(Object.keys(POS) as Host[]).map((h) => {
        const m = view.machines[h];
        const p = POS[h];
        const refusedHere = last && last.to === h && last.status >= 400;
        return (
          <g key={h}>
            <rect
              x={p.x - 78} y={p.y - 30} width={156} height={60} rx={10}
              className={refusedHere ? "fill-red-50 stroke-red-500 dark:fill-red-950" : "fill-card stroke-border"}
              strokeWidth={refusedHere ? 2 : 1}
            />
            <text x={p.x} y={p.y - 10} textAnchor="middle" className="fill-foreground text-[13px] font-semibold">{h}</text>
            <text x={p.x} y={p.y + 5} textAnchor="middle" className="fill-muted-foreground text-[10px] font-mono">{MACHINE_INFO[h].ip}:7766</text>
            <circle cx={p.x - 44} cy={p.y + 18} r={4} fill={m.agent === "awake" ? "#16a34a" : "#a3a3a3"} />
            <text x={p.x - 36} y={p.y + 21} className="fill-foreground text-[10px]">
              {AGENT[h]} {m.agent === "awake" ? "awake" : "asleep"}
            </text>
          </g>
        );
      })}
      {last && <Packet key={last.index} p={last} />}
      <text x="648" y="282" textAnchor="end" className="fill-muted-foreground text-[10px]">
        {live ? "live replies" : "scripted"} | blue: request | green: reply | red: refused
      </text>
    </svg>
  );
}
