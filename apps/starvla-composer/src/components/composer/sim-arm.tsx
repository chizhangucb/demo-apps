"use client";

import { Play, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { HeadId } from "@/lib/data";
import {
  CHUNK,
  CHUNK_LEN,
  DENOISE_STEPS,
  FAST_TOKENS,
  REST_STATE,
  TIMELINES,
  armTarget,
  ik,
  noisyChunk,
  simStateAt,
  totalDuration,
} from "@/lib/sim";
import { cn } from "@/lib/utils";

export const SIM_CAPTION =
  "This is a schematic of how the action head turns one frame into a chunk of moves. It is not policy inference and does not load a checkpoint.";

const W = 420;
const H = 250;
const px = (x: number) => x * W;
const py = (y: number) => H - y * H;
const L1 = 0.36;
const L2 = 0.32;
const BASE: [number, number] = [0.18, 0.12];
const GRASP_INDEX = 3;
const SPOON: [number, number] = [0.58, 0.14];
const TOKEN_IDS = [412, 87, 1903, 655, 33, 1201, 978, 14, 590, 1777, 302, 66, 1450, 821, 9, 1333];

const HEAD_NAME: Record<HeadId, string> = { fast: "FAST", oft: "OFT", pi: "PI (flow)", gr00t: "GR00T" };

export function SimArm({ head }: { head: HeadId }) {
  const [t, setT] = useState<number | null>(null);
  const raf = useRef<number | null>(null);
  const t0 = useRef(0);

  const stop = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    setT(null);
  }, []);

  const play = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    t0.current = performance.now();
    const total = totalDuration(head);
    const tick = (now: number) => {
      const el = now - t0.current;
      setT(el);
      if (el < total + 200) raf.current = requestAnimationFrame(tick);
      else raf.current = null;
    };
    raf.current = requestAnimationFrame(tick);
  }, [head]);

  useEffect(() => {
    // switching heads returns the arm to rest
    // eslint-disable-next-line react-hooks/set-state-in-effect
    stop();
  }, [head, stop]);
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  const s = t === null ? REST_STATE : simStateAt(head, t);
  const running = t !== null && s.phase !== "done";
  const chunk = s.noise > 0 ? noisyChunk(s.noise, s.denoiseStep) : CHUNK;
  const [tx, ty] = armTarget(s.armProgress);
  const [a1, a2] = ik(tx, ty, L1, L2, BASE);
  const elbow: [number, number] = [BASE[0] + L1 * Math.cos(a1), BASE[1] + L1 * Math.sin(a1)];
  const hand: [number, number] = [elbow[0] + L2 * Math.cos(a1 + a2), elbow[1] + L2 * Math.sin(a1 + a2)];
  const holding = s.armProgress >= GRASP_INDEX;
  const spoon = holding ? [hand[0], hand[1] - 0.03] : SPOON;
  const phases = TIMELINES[head];

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-xl border border-ink/15 bg-[oklch(0.985_0.006_85)]">
        <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
          <span className="rounded-md bg-ink px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.18em] text-paper">SIMULATION</span>
          <span className="font-mono text-[11px] text-muted-foreground">head: {HEAD_NAME[head]}</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Schematic arm, ${HEAD_NAME[head]} head, ${s.phaseLabel}`}>
          <defs>
            <pattern id="grid" width="14" height="14" patternUnits="userSpaceOnUse">
              <path d="M14 0H0V14" fill="none" stroke="oklch(0.5 0.05 250 / 0.07)" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#grid)" />
          {/* table */}
          <rect x={px(0.08)} y={py(0.12)} width={px(0.88)} height={8} rx={2} fill="oklch(0.78 0.04 70)" />
          {/* towel */}
          <rect x={px(0.75)} y={py(0.12) - 5} width={px(0.15)} height={5} rx={1.5} fill="oklch(0.72 0.1 200)" />
          <text x={px(0.825)} y={py(0.12) + 20} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>towel</text>
          {/* camera frame inset */}
          <g transform={`translate(${W - 118}, 12)`}>
            <rect width={106} height={70} rx={6} fill="oklch(0.96 0.015 85)" stroke="oklch(0.4 0.03 260 / 0.35)" />
            <rect x={8} y={36} width={90} height={26} rx={3} fill="oklch(0.86 0.04 70)" />
            <rect x={66} y={42} width={24} height={14} rx={2} fill="oklch(0.72 0.1 200)" />
            <line x1={24} y1={50} x2={46} y2={46} stroke="oklch(0.45 0.02 260)" strokeWidth={3} strokeLinecap="round" />
            <circle cx={22} cy={50} r={3.5} fill="oklch(0.45 0.02 260)" />
            <text x={8} y={16} fontSize={8.5} className="fill-ink font-mono">camera frame, t=0</text>
            <text x={8} y={28} fontSize={7.5} className="fill-muted-foreground font-mono">&quot;put spoon on towel&quot;</text>
            {running || s.phase === "done" ? (
              <rect x={0.5} y={0.5} width={105} height={69} rx={6} fill="none" stroke="var(--brick-head)" strokeWidth={1.5} />
            ) : null}
          </g>
          {/* chunk waypoints */}
          {s.chunkShown > 0 && (
            <g>
              <polyline
                points={chunk.slice(0, s.chunkShown).map(([x, y]) => `${px(x)},${py(y)}`).join(" ")}
                fill="none"
                stroke="var(--brick-head)"
                strokeWidth={1.5}
                strokeDasharray={s.noise > 0 ? "3 3" : undefined}
                opacity={0.8}
              />
              {chunk.slice(0, s.chunkShown).map(([x, y], i) => (
                <g key={i}>
                  <circle cx={px(x)} cy={py(y)} r={4.5} fill={i <= s.armProgress ? "var(--brick-head)" : "var(--card)"} stroke="var(--brick-head)" strokeWidth={1.5} />
                  <text x={px(x)} y={py(y) - 8} textAnchor="middle" fontSize={8} className="fill-muted-foreground font-mono">{i + 1}</text>
                </g>
              ))}
            </g>
          )}
          {/* spoon */}
          <line x1={px(spoon[0]) - 12} y1={py(spoon[1])} x2={px(spoon[0]) + 8} y2={py(spoon[1]) - 3} stroke="oklch(0.42 0.02 260)" strokeWidth={3} strokeLinecap="round" />
          <circle cx={px(spoon[0]) - 13} cy={py(spoon[1])} r={3.6} fill="oklch(0.42 0.02 260)" />
          {/* arm */}
          <rect x={px(BASE[0]) - 22} y={py(BASE[1]) - 10} width={44} height={14} rx={4} fill="oklch(0.32 0.05 260)" />
          <line x1={px(BASE[0])} y1={py(BASE[1])} x2={px(elbow[0])} y2={py(elbow[1])} stroke="oklch(0.32 0.05 260)" strokeWidth={11} strokeLinecap="round" />
          <line x1={px(elbow[0])} y1={py(elbow[1])} x2={px(hand[0])} y2={py(hand[1])} stroke="var(--brick-backbone)" strokeWidth={8} strokeLinecap="round" />
          <circle cx={px(BASE[0])} cy={py(BASE[1])} r={7} fill="var(--card)" stroke="oklch(0.32 0.05 260)" strokeWidth={3} />
          <circle cx={px(elbow[0])} cy={py(elbow[1])} r={5.5} fill="var(--card)" stroke="oklch(0.32 0.05 260)" strokeWidth={2.5} />
          <g transform={`translate(${px(hand[0])}, ${py(hand[1])})`}>
            <path d={holding ? "M-6 0 L-3 9 M6 0 L3 9" : "M-7 0 L-6 10 M7 0 L6 10"} stroke="oklch(0.32 0.05 260)" strokeWidth={3} strokeLinecap="round" />
            <circle r={4} fill="var(--brick-head)" />
          </g>
          {/* GR00T system 2 plan beat */}
          {head === "gr00t" && s.planShown && (
            <g transform="translate(12, 46)">
              <rect width={196} height={40} rx={8} fill="oklch(0.95 0.03 250)" stroke="var(--brick-backbone)" />
              <text x={10} y={16} fontSize={9} className="fill-ink font-mono" fontWeight={600}>System 2 plan latent</text>
              <text x={10} y={30} fontSize={8.5} className="fill-muted-foreground font-mono">reach spoon, grasp, carry to towel</text>
            </g>
          )}
          {s.denoiseStep > 0 && s.noise > 0 && (
            <text x={14} y={H - 14} fontSize={10} className="fill-ink font-mono">
              {head === "gr00t" ? "System 1 " : ""}denoise step {s.denoiseStep}/{DENOISE_STEPS[head]}
            </text>
          )}
        </svg>
      </div>

      {head === "fast" && (
        <div className="flex flex-wrap gap-1" aria-label="FAST action tokens">
          {TOKEN_IDS.slice(0, FAST_TOKENS).map((id, i) => (
            <span
              key={i}
              className={cn(
                "rounded border px-1.5 py-0.5 font-mono text-[10px] transition-opacity",
                i < s.tokensShown ? "border-brick-head/60 bg-brick-head/10 text-ink opacity-100" : "border-dashed border-ink/15 text-transparent opacity-60",
              )}
            >
              {i < s.tokensShown ? `<a${id}>` : "<a____>"}
            </span>
          ))}
        </div>
      )}

      <ol className="flex flex-wrap gap-1.5 text-[11px]">
        {phases.map((p, i) => (
          <li
            key={p.kind + i}
            className={cn(
              "rounded-full border px-2.5 py-1 transition-colors",
              t !== null && (s.phaseIndex > i || s.phase === "done")
                ? "border-brick-recipe/40 bg-brick-recipe/10 text-ink"
                : s.phaseIndex === i && running
                  ? "border-brick-head bg-brick-head/15 font-medium text-ink"
                  : "border-ink/15 text-muted-foreground",
            )}
          >
            {i + 1}. {p.label}
          </li>
        ))}
      </ol>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={play} data-testid="sim-play">
          <Play data-icon="inline-start" /> Play {HEAD_NAME[head]}
        </Button>
        <Button size="sm" variant="outline" onClick={stop} data-testid="sim-stop">
          <Square data-icon="inline-start" /> Stop
        </Button>
        <span className="ml-1 truncate font-mono text-[11px] text-muted-foreground" aria-live="polite">
          {t === null ? "At rest" : s.phaseLabel}
        </span>
      </div>

      <p className="rounded-lg border border-dashed border-ink/25 bg-secondary/60 px-3 py-2 text-[12.5px] leading-snug text-ink" data-testid="sim-caption">
        {SIM_CAPTION}
      </p>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Example chunk: {CHUNK_LEN} steps. Real horizons vary: the RoboCasa365 public QwenOFT uses horizon 16 and the RoboCasa GR1 eval example uses n_action_steps 12.
      </p>
    </div>
  );
}
