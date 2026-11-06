"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingBlock, ErrorBox } from "./compare";
import { ExtLink } from "./weight-explorer";
import { Markdownish } from "./markdownish";
import { passTurns, runStats, type Benchmark, type BenchmarkFile, type Run, type TrajectoryFile, type Turn } from "@/lib/data";
import { AUTHOR_ACCOUNT_P50C, SRC } from "@/lib/sources";
import { cn } from "@/lib/utils";

const BUDGETS = [0, 10, 25, 50];

export function Experiment() {
  const [bench, setBench] = useState<BenchmarkFile | null>(null);
  const [traj, setTraj] = useState<TrajectoryFile | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const get = (u: string) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${u}: HTTP ${r.status}`))));
    Promise.all([get("/data/author-benchmarks.json"), get("/data/author-trajectories.json")])
      .then(([b, t]) => {
        setBench(b);
        setTraj(t);
      })
      .catch((e) => setErr(String(e?.message ?? e)));
  }, []);

  if (err) return <ErrorBox title="Could not load author data" msg={err} />;
  if (!bench || !traj) return <LoadingBlock label="loading author-benchmarks.json and author-trajectories.json" />;
  return (
    <div className="flex flex-col gap-4">
      <BenchmarkSection data={bench} />
      <Timeline data={traj} />
    </div>
  );
}

function BenchmarkSection({ data }: { data: BenchmarkFile }) {
  const [sel, setSel] = useState(0);
  const b = data.benchmarks[sel];
  return (
    <section className="lab-panel p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="lab-label">author-reported · score vs forward-pass budget</div>
          <h2 className="font-heading text-xl font-semibold tracking-tight">Budget 0, 10, 25, 50: one independent run each</h2>
        </div>
        <div className="flex gap-3 font-mono text-[11px]">
          <ExtLink href={SRC.benchmarksJson}>benchmarks.json</ExtLink>
          <ExtLink href={SRC.blog}>blog</ExtLink>
        </div>
      </div>
      <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-muted-foreground">
        Each budget is a separate editing run (p10c, p25c, p50c; 0 is the unedited model) evaluated by the authors with thinking on, up to 32,768 tokens. Lines only connect separate runs for reading; they are not a training curve.
      </p>
      <div className="mt-3 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-md border border-border bg-background/40 p-3">
          <div className="flex items-baseline justify-between">
            <span className="font-heading text-[15px] font-semibold">{b.name}</span>
            <span className="font-mono text-[11px] text-muted-foreground">group: {b.group}</span>
          </div>
          <BenchChart b={b} big />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
          {data.benchmarks.map((x, i) => (
            <button
              key={x.name}
              onClick={() => setSel(i)}
              className={cn("rounded-md border p-2 text-left transition-colors", i === sel ? "border-edited/60 bg-edited/[0.06]" : "border-border bg-background/30 hover:border-foreground/30")}
            >
              <div className="flex items-baseline justify-between gap-1">
                <span className="truncate text-[12px] font-medium">{x.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{x.group}</span>
              </div>
              <BenchChart b={x} />
              <div className="font-mono text-[10.5px] text-muted-foreground">
                {x.points.map((p) => p.score.toFixed(1)).join(" · ")}
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function BenchChart({ b, big = false }: { b: Benchmark; big?: boolean }) {
  const W = big ? 560 : 200, H = big ? 260 : 56;
  const pad = big ? { l: 44, r: 44, t: 22, b: 32 } : { l: 4, r: 4, t: 6, b: 6 };
  const max = big ? Math.max(60, Math.ceil(Math.max(...b.points.map((p) => p.score)) / 10) * 10) : 100;
  const x = (i: number) => pad.l + (i / (BUDGETS.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const path = b.points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.score)}`).join(" ");
  const ticks = big ? Array.from({ length: max / 10 + 1 }, (_, i) => i * 10) : [];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${b.name}: ${b.points.map((p) => `${p.passes} passes ${p.score}%`).join(", ")}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="currentColor" className="text-border" />
          <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">{t}%</text>
        </g>
      ))}
      {big && (
        <text x={12} y={pad.t + (H - pad.t - pad.b) / 2} transform={`rotate(-90 12 ${pad.t + (H - pad.t - pad.b) / 2})`} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">score %</text>
      )}
      <path d={path} fill="none" stroke="var(--edited)" strokeWidth={big ? 2 : 1.5} strokeDasharray={big ? "5 4" : undefined} opacity={big ? 0.6 : 0.9} />
      {b.points.map((p, i) => (
        <g key={p.passes}>
          <circle cx={x(i)} cy={y(p.score)} r={big ? 5 : 2.2} fill={p.passes === 0 ? "var(--base)" : "var(--edited)"} stroke="var(--background)" strokeWidth={big ? 2 : 0.5} />
          {big && (
            <>
              <text x={x(i) + (i === 0 ? 10 : 0)} y={y(p.score) - 10} textAnchor={i === 0 ? "start" : "middle"} className="fill-foreground font-mono text-[12px] font-medium">{p.score.toFixed(1)}</text>
              <text x={x(i)} y={H - 10} textAnchor="middle" className="fill-muted-foreground font-mono text-[10.5px]">
                {p.passes === 0 ? "0 (base)" : `${p.passes} passes`}
              </text>
            </>
          )}
        </g>
      ))}
    </svg>
  );
}

const RUN_ORDER = ["p10c", "p25c", "p50c"];

const KIND_COLOR: Record<Turn["kind"], string> = { python: "oklch(0.72 0.12 300)", forward: "var(--edited)", final: "var(--base)" };

function Timeline({ data }: { data: TrajectoryFile }) {
  const runs = useMemo(() => RUN_ORDER.map((r) => data.runs.find((x) => x.run === r)).filter(Boolean) as Run[], [data]);
  const [ri, setRi] = useState(2);
  const run = runs[ri];
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stats = useMemo(() => runStats(run), [run]);
  const turn = run.turns[t];

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setT((x) => {
        if (x >= run.turns.length - 1) {
          setPlaying(false);
          return x;
        }
        return x + 1;
      });
    }, 450);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, run]);

  return (
    <section className="lab-panel p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="lab-label">author-reported · editing agent diary</div>
          <h2 className="font-heading text-xl font-semibold tracking-tight">Turn by turn through each budgeted run</h2>
        </div>
        <ExtLink href={SRC.trajectoriesJson}>trajectories.json</ExtLink>
      </div>
      <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-muted-foreground">
        Replay of the recorded log, not a new run. Every field below is shown as it appears in the published JSON. A forward pass is one counted model evaluation from the run&apos;s budget.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {runs.map((r, i) => (
          <button
            key={r.run}
            onClick={() => { setRi(i); setT(0); setPlaying(false); }}
            className={cn("rounded-md border px-3 py-1.5 font-mono text-[12px]", i === ri ? "border-edited/60 bg-edited/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
          >
            {r.run} <span className="text-muted-foreground">· budget {r.budget} · {r.turns.length} turns</span>
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px] sm:grid-cols-5 lg:grid-cols-9">
        <Cell k="turns" v={stats.turns} />
        <Cell k="python ran" v={stats.pythonRan} />
        <Cell k="python not run" v={stats.pythonSkipped} />
        <Cell k="forward turns" v={stats.forwardTurns} />
        <Cell k="passes used" v={`${stats.passesUsed}/${run.budget}`} />
        <Cell k="failed passes" v={stats.failedPasses} />
        <Cell k="edit turns" v={stats.edits} />
        <Cell k="key turns" v={stats.key} />
        <Cell k="errors" v={stats.errors} />
      </div>
      {run.run === "p50c" && (
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          Author&apos;s own account of p50c (blog): {AUTHOR_ACCOUNT_P50C.turns} turns, {AUTHOR_ACCOUNT_P50C.pythonRuns} Python runs, {AUTHOR_ACCOUNT_P50C.forwardPasses} forward passes, {AUTHOR_ACCOUNT_P50C.handoffs} handoffs. Counted here from the JSON: {stats.turns} turns, {stats.pythonRan} Python turns that ran, {stats.passesUsed} passes used. Handoffs are not a field in the JSON.
        </p>
      )}

      <Track run={run} t={t} onPick={setT} />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="icon-sm" variant="ghost" aria-label="previous turn" onClick={() => setT((x) => Math.max(0, x - 1))}><SkipBack /></Button>
        <Button size="sm" variant="outline" onClick={() => { if (t >= run.turns.length - 1) setT(0); setPlaying((p) => !p); }}>
          {playing ? <Pause /> : <Play />} {playing ? "Pause" : "Replay diary"}
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="next turn" onClick={() => setT((x) => Math.min(run.turns.length - 1, x + 1))}><SkipForward /></Button>
        <input
          type="range"
          min={0}
          max={run.turns.length - 1}
          value={t}
          onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }}
          className="min-w-40 flex-1 accent-[var(--edited)]"
          aria-label="scrub turns"
        />
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">turn {turn.turn} / {run.turns.length}</span>
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <TurnCard turn={turn} budget={run.budget} />
        <div className="rounded-md border border-border bg-background/40 p-3">
          <div className="lab-label">{run.run} final note (verbatim)</div>
          <div className="thin-scroll mt-1 max-h-[360px] overflow-y-auto pr-1 text-[12.5px] leading-relaxed text-foreground/90">
            <Markdownish src={run.final} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Cell({ k, v }: { k: string; v: number | string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 px-2 py-1.5">
      <div className="text-[9.5px] tracking-wider text-muted-foreground uppercase">{k}</div>
      <div className="text-[14px] text-foreground tabular-nums">{v}</div>
    </div>
  );
}

function Track({ run, t, onPick }: { run: Run; t: number; onPick: (i: number) => void }) {
  const W = 1000, H = 150, padL = 34, padR = 8, top = 10, mid = 96;
  const n = run.turns.length;
  const x = (i: number) => padL + (i / Math.max(1, n - 1)) * (W - padL - padR);
  const y = (used: number) => mid - (used / run.budget) * (mid - top);
  const step = run.turns.map((tt, i) => `${i ? "L" : "M"}${x(i)},${y(tt.used_after)}`).join(" ");
  const gens = passTurns(run).filter((tt) => tt.pass && "type" in tt.pass && tt.pass.type === "generate" && tt.pass.edited != null);
  return (
    <div className="mt-3 rounded-md border border-border bg-background/40 p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${run.run} timeline: forward passes used per turn`}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={padL} x2={W - padR} y1={y(run.budget * f)} y2={y(run.budget * f)} stroke="currentColor" className="text-border" />
            <text x={padL - 5} y={y(run.budget * f) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">{Math.round(run.budget * f)}</text>
          </g>
        ))}
        <text x={padL + 4} y={top + 10} className="fill-muted-foreground font-mono text-[10px]">forward passes used (left axis)</text>
        <path d={step} fill="none" stroke="var(--edited)" strokeWidth={1.6} />
        {gens.map((g) => {
          const i = run.turns.indexOf(g);
          const p = g.pass as { edited: number };
          return <circle key={g.turn} cx={x(i)} cy={mid - (p.edited / 100) * (mid - top)} r={2.4} fill="var(--base)" opacity={0.75}><title>turn {g.turn}: edited practice accuracy {p.edited}%</title></circle>;
        })}
        {run.turns.map((tt, i) => (
          <g key={tt.turn} onClick={() => onPick(i)} className="cursor-pointer">
            <rect x={x(i) - (W / n) / 2} y={mid + 8} width={Math.max(1, W / n)} height={36} fill="transparent" />
            <line x1={x(i)} x2={x(i)} y1={mid + 12} y2={mid + (tt.kind === "forward" ? 34 : tt.kind === "final" ? 40 : 24)} stroke={tt.not_run ? "oklch(0.5 0.02 250)" : KIND_COLOR[tt.kind]} strokeWidth={i === t ? 3 : 1.4} opacity={tt.not_run ? 0.5 : 1} />
            {tt.edit && <rect x={x(i) - 2.5} y={mid + 3} width={5} height={5} transform={`rotate(45 ${x(i)} ${mid + 5.5})`} fill="var(--base)" />}
            {tt.error && <circle cx={x(i)} cy={mid + 46} r={2} fill="var(--destructive)" />}
          </g>
        ))}
        <line x1={x(t)} x2={x(t)} y1={top} y2={H - 2} stroke="var(--foreground)" strokeOpacity={0.35} strokeDasharray="2 3" />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[10.5px] text-muted-foreground">
        <Legend c={KIND_COLOR.python} l="python turn" />
        <Legend c={KIND_COLOR.forward} l="forward turn (tall)" />
        <Legend c={KIND_COLOR.final} l="final" />
        <span className="flex items-center gap-1.5"><span className="inline-block size-2 rotate-45 bg-base" />edit=true</span>
        <span className="flex items-center gap-1.5"><span className="inline-block size-1.5 rounded-full bg-destructive" />error</span>
        <span className="flex items-center gap-1.5"><span className="inline-block size-1.5 rounded-full bg-base" />edited % in a generate pass (0 to 100 on the same height)</span>
      </div>
    </div>
  );
}

function Legend({ c, l }: { c: string; l: string }) {
  return <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-[3px]" style={{ background: c }} />{l}</span>;
}

function TurnCard({ turn, budget }: { turn: Turn; budget: number }) {
  const p = turn.pass;
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
        <span className="rounded-sm px-1.5 py-0.5 text-background" style={{ background: KIND_COLOR[turn.kind] }}>{turn.kind}</span>
        <span className="text-foreground">turn {turn.turn}</span>
        <span className="text-muted-foreground">passes {turn.used} → {turn.used_after} of {budget}</span>
        {turn.edit && <Flag c="text-base border-base/50">edit</Flag>}
        {turn.key && <Flag c="text-edited border-edited/50">key</Flag>}
        {turn.not_run && <Flag c="text-muted-foreground border-border">not_run</Flag>}
      </div>
      {turn.hypothesis && (
        <Field k="hypothesis">{turn.hypothesis}</Field>
      )}
      {turn.summary && <Field k="summary">{turn.summary}</Field>}
      {turn.said && turn.kind !== "final" && <Field k="said"><span className="whitespace-pre-wrap">{turn.said}</span></Field>}
      {turn.kind === "final" && <Field k="said">The final note is shown on the right.</Field>}
      {turn.error && <Field k="error"><code className="font-mono text-[11.5px] text-destructive">{turn.error}</code></Field>}
      {p && (
        <div className="mt-2">
          <div className="lab-label">pass</div>
          {"failed" in p ? (
            <div className="font-mono text-[12px] text-destructive">failed: true</div>
          ) : (
            <div className="mt-1 grid grid-cols-2 gap-1.5 font-mono text-[11px] sm:grid-cols-4">
              {Object.entries(p).map(([k, v]) => (
                <div key={k} className="rounded border border-border px-2 py-1">
                  <div className="text-[9.5px] tracking-wider text-muted-foreground uppercase">{k}</div>
                  <div className="text-foreground">{String(v)}{["original", "edited"].includes(k) ? "%" : ["difference", "se"].includes(k) ? " pts" : ""}</div>
                </div>
              ))}
            </div>
          )}
          {!("failed" in p) && p.type === "generate" && <p className="mt-1 text-[11px] text-muted-foreground">Accuracy fields are percent on the agent&apos;s practice sample; cut fields are the fraction cut off at the token limit.</p>}
        </div>
      )}
      {!turn.hypothesis && !turn.summary && !turn.said && !turn.error && !p && <Field k="note">This turn carries no text fields in the log.</Field>}
    </div>
  );
}

function Flag({ c, children }: { c: string; children: React.ReactNode }) {
  return <span className={cn("rounded-sm border px-1.5 py-0.5", c)}>{children}</span>;
}

function Field({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="mt-2">
      <div className="lab-label">{k}</div>
      <div className="mt-0.5 text-[13px] leading-relaxed text-foreground/90">{children}</div>
    </div>
  );
}
