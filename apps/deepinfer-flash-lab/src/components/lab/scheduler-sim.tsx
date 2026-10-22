"use client";

import { useEffect, useState } from "react";
import { cn } from "cn";
import { Panel, SimTag, Src } from "./bits";

// Illustrative durations in arbitrary units. Not measurements.
const D = { schedule: 2, launch: 1, forward: 6, sample: 2, post: 2 };

type Block = { lane: "CPU" | "GPU"; label: string; start: number; len: number; kind: "cpu" | "gpu" | "idle" };

const SHORT: [string, string][] = [
  ["launch_forward", "lf"],
  ["launch_sample", "ls"],
  ["post-process", "pp"],
  ["schedule", "sch"],
  ["forward", "fwd"],
  ["sample", "smp"],
];

// Compact block label, e.g. "schedule(N+1)" -> "sch N+1".
export function shortLabel(label: string): string {
  const m = /^([a-z_-]+)\((.+)\)$/.exec(label);
  if (!m) return label;
  const abbr = SHORT.find(([full]) => full === m[1])?.[1] ?? m[1];
  return `${abbr} ${m[2]}`;
}

export function buildTimeline(mode: "sync" | "async", steps = 3): Block[] {
  const out: Block[] = [];
  if (mode === "sync") {
    let t = 0;
    for (let i = 0; i < steps; i++) {
      const n = i === 0 ? "N" : `N+${i}`;
      out.push({ lane: "CPU", label: `schedule(${n})`, start: t, len: D.schedule, kind: "cpu" });
      out.push({ lane: "GPU", label: "idle", start: t, len: D.schedule, kind: "idle" });
      t += D.schedule;
      out.push({ lane: "GPU", label: `forward(${n})`, start: t, len: D.forward, kind: "gpu" });
      t += D.forward;
      out.push({ lane: "GPU", label: `sample(${n})`, start: t, len: D.sample, kind: "gpu" });
      t += D.sample;
      out.push({ lane: "CPU", label: `post-process(${n})`, start: t, len: D.post, kind: "cpu" });
      out.push({ lane: "GPU", label: "idle", start: t, len: D.post, kind: "idle" });
      t += D.post;
    }
    return out;
  }
  // async: CPU prepares step N+1 while the GPU runs step N (order from the Q&A doc)
  out.push({ lane: "CPU", label: "schedule(N)", start: 0, len: D.schedule, kind: "cpu" });
  out.push({ lane: "GPU", label: "idle", start: 0, len: D.schedule, kind: "idle" });
  let t = D.schedule;
  for (let i = 0; i < steps; i++) {
    const n = i === 0 ? "N" : `N+${i}`;
    const next = `N+${i + 1}`;
    const prev = i === 0 ? "N-1" : i === 1 ? "N" : `N+${i - 1}`;
    out.push({ lane: "GPU", label: `forward(${n})`, start: t, len: D.forward, kind: "gpu" });
    out.push({ lane: "GPU", label: `sample(${n})`, start: t + D.forward, len: D.sample, kind: "gpu" });
    let c = t;
    for (const [label, len] of [
      [`schedule(${next})`, D.schedule],
      [`launch_forward(${next})`, D.launch],
      [`post-process(${prev})`, D.post],
      [`launch_sample(${next})`, D.launch],
    ] as const) {
      out.push({ lane: "CPU", label, start: c, len, kind: "cpu" });
      c += len;
    }
    t += D.forward + D.sample;
  }
  return out;
}

const SPAN = 36; // the sync timeline length for 3 steps, shared scale

export function SchedulerSim() {
  const [mode, setMode] = useState<"sync" | "async">("async");
  const [head, setHead] = useState(0);
  const blocks = buildTimeline(mode);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      setHead((h) => {
        const nh = h + ((now - last) / 1000) * 6;
        return nh > SPAN + 4 ? 0 : nh;
      });
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <Panel
      channel="CH.05"
      title="Batch scheduler timeline"
      tag={<SimTag />}
      right={
        <div className="flex border border-border font-mono text-[10px]">
          {(["sync", "async"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cn("px-2 py-1", mode === m ? "bg-sim/15 text-sim" : "text-muted-foreground")}>
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      }
    >
      <p className="mb-3 font-mono text-[10.5px] text-muted-foreground">
        A decode step is schedule, forward, sample, post-process. Without overlap the GPU idles during post-process(N) and schedule(N+1). With the
        zero-overhead scheduler the CPU runs schedule(N+1), launch_forward(N+1), post-process(N-1), launch_sample(N+1) while the GPU runs forward(N)
        and sample(N) <Src k="qa" />. On by default in DeepInfer <Src k="readme" />. Block lengths are illustrative, not measured.
      </p>

      <div className="relative border border-border bg-[#03070a] p-3">
        {(["CPU", "GPU"] as const).map((lane) => (
          <div key={lane} className="mb-2 flex items-center gap-2 last:mb-0">
            <span className="w-8 font-mono text-[10px] tracking-[0.16em] text-muted-foreground">{lane}</span>
            <div className="relative h-11 flex-1 border border-border/50 bg-black/40">
              {blocks
                .filter((b) => b.lane === lane)
                .map((b, i) => {
                  const lit = head >= b.start;
                  return (
                    <div
                      key={i}
                      title={b.label}
                      className={cn(
                        "absolute top-0.5 bottom-0.5 flex items-center justify-center overflow-hidden border px-px font-mono text-[8.5px] leading-tight transition-opacity duration-300",
                        b.kind === "gpu" && "border-cyan-glow/60 bg-cyan-glow/15 text-cyan-glow",
                        b.kind === "cpu" && "border-sim/50 bg-sim/10 text-sim",
                        b.kind === "idle" && "hatch-idle border-fail/50 text-fail",
                        lit ? "opacity-100" : "opacity-25",
                        lit && b.kind === "gpu" && "shadow-[0_0_10px_rgba(56,232,255,0.35)]",
                      )}
                      style={{ left: `${(b.start / SPAN) * 100}%`, width: `${(b.len / SPAN) * 100}%` }}
                    >
                      {b.kind !== "idle" && <span className="truncate">{shortLabel(b.label)}</span>}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
        <div className="pointer-events-none absolute top-2 bottom-2 left-[2.75rem] right-3">
          <div
            className="absolute top-0 bottom-0 w-px bg-foreground/80 shadow-[0_0_8px_rgba(255,255,255,0.7)]"
            style={{ left: `${(Math.min(head, SPAN) / SPAN) * 100}%` }}
          />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4 font-mono text-[10px] text-muted-foreground">
        <Legend cls="border-cyan-glow/60 bg-cyan-glow/15" label="GPU work" />
        <Legend cls="border-sim/50 bg-sim/10" label="CPU work" />
        <Legend cls="hatch-idle border-fail/50" label="GPU idle" />
        <span>sch schedule, lf launch_forward, fwd forward, smp sample, pp post-process, ls launch_sample</span>
        <span className="ml-auto">3 decode steps; {mode === "sync" ? "GPU waits on the CPU every step" : "GPU stays busy after the first schedule"}</span>
      </div>
    </Panel>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("inline-block h-2.5 w-4 border", cls)} />
      {label}
    </span>
  );
}
