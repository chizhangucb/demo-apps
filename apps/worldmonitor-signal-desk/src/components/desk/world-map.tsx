"use client";

import { useEffect, useRef } from "react";
import { geoEquirectangular, geoGraticule10, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import land110 from "@/data/land-110m.json";
import { ARCS, CONTRACT_SITES, EVENT_SITES, ZONES, heatPoints, type EventColor, type LonLat } from "@/lib/geo";
import type { Flash } from "@/lib/engine";

export const LAT_TOP = 84;
export const LAT_BOTTOM = -58;
export const MAP_ASPECT = 360 / (LAT_TOP - LAT_BOTTOM);

const topo = land110 as unknown as Topology<{ land: GeometryCollection }>;
const LAND = feature(topo, topo.objects.land);
const HEAT = heatPoints();

const DOT: Record<EventColor, string> = {
  orange: "255,140,40",
  yellow: "255,214,64",
  blue: "110,190,255",
};

export interface Quake {
  at: LonLat;
  mag: number;
}

interface Props {
  flashes: { current: Flash[] };
  quakes?: Quake[];
}

export function WorldMap({ flashes, quakes = [] }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const quakesRef = useRef<Quake[]>(quakes);

  useEffect(() => {
    quakesRef.current = quakes;
  }, [quakes]);

  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let W = 0;
    let H = 0;
    let CW = 0;
    let k = 1;
    let dpr = 1;
    let land: HTMLCanvasElement | null = null;
    let hex: HTMLCanvasElement | null = null;
    let raf = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    const proj = (p: LonLat): [number, number] => [(p[0] + 180) * k, (LAT_TOP - p[1]) * k];

    const layer = () => {
      const c = document.createElement("canvas");
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      const g = c.getContext("2d")!;
      g.scale(dpr, dpr);
      return { c, g };
    };

    const build = () => {
      const projection = geoEquirectangular()
        .scale(W / (2 * Math.PI))
        .translate([W / 2, LAT_TOP * k]);

      const l = layer();
      const path = geoPath(projection, l.g);
      l.g.beginPath();
      path(geoGraticule10());
      l.g.strokeStyle = "rgba(90,110,140,0.08)";
      l.g.lineWidth = 0.5;
      l.g.stroke();
      l.g.beginPath();
      path(LAND);
      l.g.fillStyle = "rgba(40,52,72,0.28)";
      l.g.fill();
      l.g.strokeStyle = "rgba(170,182,200,0.42)";
      l.g.lineWidth = 0.6;
      l.g.stroke();
      land = l.c;

      const h = layer();
      const R = Math.max(3.2, W / 120);
      const dx = Math.sqrt(3) * R;
      const dy = 1.5 * R;
      const bins = new Map<string, { x: number; y: number; n: number }>();
      for (const p of HEAT) {
        const [x, y] = proj(p);
        const row = Math.round(y / dy);
        const col = Math.round((x - (row % 2 ? dx / 2 : 0)) / dx);
        const key = `${row}:${col}`;
        const b = bins.get(key);
        if (b) b.n++;
        else bins.set(key, { x: col * dx + (row % 2 ? dx / 2 : 0), y: row * dy, n: 1 });
      }
      const max = Math.max(...[...bins.values()].map((b) => b.n));
      for (const b of bins.values()) {
        if (b.n < 2) continue;
        const v = Math.pow(b.n / max, 0.6);
        const color = v > 0.66 ? "255,52,52" : v > 0.44 ? "255,140,40" : v > 0.26 ? "255,214,64" : "120,196,255";
        h.g.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i + Math.PI / 6;
          const px = b.x + (R - 0.6) * Math.cos(a);
          const py = b.y + (R - 0.6) * Math.sin(a);
          if (i) h.g.lineTo(px, py);
          else h.g.moveTo(px, py);
        }
        h.g.closePath();
        h.g.fillStyle = `rgba(${color},${0.1 + 0.55 * v})`;
        h.g.fill();
        if (v > 0.5) {
          h.g.strokeStyle = `rgba(${color},0.7)`;
          h.g.lineWidth = 0.5;
          h.g.stroke();
        }
      }
      hex = h.c;
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      CW = wrap.clientWidth;
      // The world is drawn wider than the panel when needed; it pans anyway.
      H = Math.round(Math.min(560, Math.max(240, CW * 0.47)));
      W = Math.max(CW, H * MAP_ASPECT);
      H = W / MAP_ASPECT;
      k = W / 360;
      canvas.width = Math.round(CW * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.height = `${H}px`;
      build();
    };

    const quad = (a: [number, number], b: [number, number], u: number): [number, number] => {
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const cx = mx;
      const cy = my - d * 0.32;
      const iu = 1 - u;
      return [iu * iu * a[0] + 2 * iu * u * cx + u * u * b[0], iu * iu * a[1] + 2 * iu * u * cy + u * u * b[1]];
    };

    const drawWorld = (x0: number, t: number, now: number) => {
      ctx.save();
      ctx.translate(x0, 0);

      for (const z of ZONES) {
        const [x, y] = proj(z.at);
        const r = z.r * k * (1 + 0.08 * Math.sin(t * 0.7 + x));
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
        g.addColorStop(0, `rgba(${z.color},0.28)`);
        g.addColorStop(0.5, `rgba(${z.color},0.1)`);
        g.addColorStop(1, `rgba(${z.color},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 0.82 + 0.18 * Math.sin(t * 1.3);
      ctx.drawImage(land!, 0, 0, W, H);
      ctx.drawImage(hex!, 0, 0, W, H);
      ctx.globalAlpha = 1;

      ARCS.forEach(([ai, bi], i) => {
        const a = proj(EVENT_SITES[ai].at);
        const b = proj(EVENT_SITES[bi].at);
        ctx.beginPath();
        for (let s = 0; s <= 24; s++) {
          const [x, y] = quad(a, b, s / 24);
          if (s) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.strokeStyle = "rgba(120,200,255,0.32)";
        ctx.lineWidth = 0.9;
        ctx.stroke();
        for (let j = 0; j < 2; j++) {
          const u = (t * 0.22 + i * 0.137 + j * 0.5) % 1;
          const [x, y] = quad(a, b, u);
          ctx.shadowColor = "rgba(200,235,255,0.95)";
          ctx.shadowBlur = 8;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(x, y, 1.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      EVENT_SITES.forEach((e, i) => {
        const [x, y] = proj(e.at);
        const c = DOT[e.color];
        const period = 2.4;
        const ph = ((t + i * 0.43) % period) / period;
        ctx.strokeStyle = `rgba(${c},${0.85 * (1 - ph)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x, y, 2 + ph * 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowColor = `rgba(${c},1)`;
        ctx.shadowBlur = 10;
        ctx.fillStyle = `rgb(${c})`;
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      for (const q of quakesRef.current) {
        const [x, y] = proj(q.at);
        ctx.strokeStyle = "rgba(255,214,64,0.8)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 1 + q.mag * 1.4, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (const f of flashes.current) {
        const age = (now - f.born) / 1000;
        if (age > 2.6) continue;
        const [x, y] = proj(CONTRACT_SITES[f.contract]);
        const c = f.win ? "57,255,136" : "255,59,92";
        const u = age / 2.6;
        ctx.strokeStyle = `rgba(${c},${1 - u})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = `rgba(${c},1)`;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(x, y, 4 + u * 34, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(${c},${1 - u})`;
        ctx.font = "600 10px var(--font-mono), monospace";
        ctx.fillText(f.win ? "FILL +" : "FILL -", x + 8, y - 8 - u * 10);
      }
      ctx.restore();
    };

    const start = performance.now();
    let last = start;
    let clock = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden || !land) return;
      const speed = reduce.matches ? 0.25 : 1;
      clock += Math.min(now - last, 100) * speed;
      last = now;
      const t = clock / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#04070d";
      ctx.fillRect(0, 0, CW, H);
      const offset = (t * 9) % W;
      for (let x0 = -offset; x0 < CW; x0 += W) drawWorld(x0, t, now);

      for (let i = 0; i < 3; i++) {
        const y = (t * 22 + (i * H) / 3) % H;
        ctx.fillStyle = "rgba(255,50,60,0.22)";
        ctx.fillRect(0, y, CW, 1);
      }
      const v = ctx.createRadialGradient(CW / 2, H / 2, H * 0.3, CW / 2, H / 2, CW * 0.62);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, CW, H);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [flashes]);

  return (
    <div ref={wrapRef} className="relative w-full">
      <canvas ref={canvasRef} className="block w-full" aria-label="Simulated global event feed map" />
    </div>
  );
}
