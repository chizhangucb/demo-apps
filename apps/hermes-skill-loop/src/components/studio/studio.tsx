"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Eye,
  FastForward,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  Snowflake,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { TASKS } from "@data/tasks";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { extractionTrace, sleep, statsOf } from "@/lib/harness";
import { cn } from "@/lib/utils";
import type {
  LiveExtractResponse,
  LiveRunResponse,
  RunStats,
  RunStep,
  Skill,
  StepKind,
  TaskPair,
} from "@/lib/types";

const BOOKMARK = "https://x.com/JacquelineSYC19/status/2100262432413528336";
const HERMES = "https://github.com/nousresearch/hermes-agent";

type Mode = "scripted" | "live";
type Phase = "idle" | "running" | "done";
type Variant = "warm" | "cold";

async function post<T>(body: unknown): Promise<T> {
  const res = await fetch("/api/loop", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  // Platform error pages (timeouts, 5xx) come back as HTML, not JSON — never let parsing throw opaquely.
  const text = await res.text();
  let data: { error?: string } | null = null;
  try {
    data = JSON.parse(text);
  } catch {
    // fall through with data = null
  }
  if (!res.ok || !data) throw new Error(data?.error ?? `Request failed (HTTP ${res.status})`);
  return data as T;
}

const KIND_ICON: Record<StepKind, typeof Brain> = {
  think: Brain,
  tool: Wrench,
  observe: Eye,
  answer: CheckCircle2,
  skill: BookOpen,
};

export function Studio({ liveAvailable, model }: { liveAvailable: boolean; model: string }) {
  const [pairId, setPairId] = useState(TASKS[0].id);
  const pair = TASKS.find((t) => t.id === pairId) as TaskPair;
  const [mode, setMode] = useState<Mode>("scripted");
  const [fast, setFast] = useState(false);

  const [learnSteps, setLearnSteps] = useState<RunStep[]>([]);
  const [learnPhase, setLearnPhase] = useState<Phase>("idle");
  const [learnOutcome, setLearnOutcome] = useState<string | null>(null);

  const [trace, setTrace] = useState<string[]>([]);
  const [extractPhase, setExtractPhase] = useState<Phase>("idle");
  const [skill, setSkill] = useState<Skill | null>(null);

  const [reuseSteps, setReuseSteps] = useState<RunStep[]>([]);
  const [reusePhase, setReusePhase] = useState<Phase>("idle");
  const [reuseVariant, setReuseVariant] = useState<Variant>("warm");
  const [reuseOutcome, setReuseOutcome] = useState<string | null>(null);
  const [measured, setMeasured] = useState<Partial<Record<Variant, RunStats>>>({});

  const [library, setLibrary] = useState<Skill[]>([]);
  const [error, setError] = useState<string | null>(null);
  const runId = useRef(0);
  const learnBox = useRef<HTMLDivElement>(null);
  const reuseBox = useRef<HTMLDivElement>(null);

  const busy = learnPhase === "running" || extractPhase === "running" || reusePhase === "running";
  const delay = fast ? 160 : 520;
  const activeSkillStep = reusePhase === "running" ? reuseSteps.at(-1)?.skillStep : undefined;

  // Keep each timeline pinned to its newest step by scrolling only its own box. Page-level smooth
  // scrollIntoView on every replayed step fought the layout and could take down the tab.
  useEffect(() => {
    const el = learnBox.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [learnSteps.length]);
  useEffect(() => {
    const el = reuseBox.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [reuseSteps.length]);

  function reset(nextPair = pairId) {
    runId.current++;
    setPairId(nextPair);
    setLearnSteps([]);
    setLearnPhase("idle");
    setLearnOutcome(null);
    setTrace([]);
    setExtractPhase("idle");
    setSkill(null);
    setReuseSteps([]);
    setReusePhase("idle");
    setReuseOutcome(null);
    setMeasured({});
    setError(null);
  }

  /** Replay steps into the timeline one at a time; returns false if a reset cancelled it. */
  async function replay(steps: RunStep[], push: (s: RunStep) => void, id: number) {
    for (const s of steps) {
      if (runId.current !== id) return false;
      push(s);
      await sleep(delay);
    }
    return runId.current === id;
  }

  async function runLearn(id: number): Promise<{ steps: RunStep[]; outcome: string } | null> {
    setLearnSteps([]);
    setLearnOutcome(null);
    setLearnPhase("running");
    const run =
      mode === "live"
        ? await post<LiveRunResponse>({ phase: "run", prompt: pair.learn.prompt })
        : { steps: pair.learn.steps, outcome: pair.learn.outcome };
    if (!(await replay(run.steps, (s) => setLearnSteps((p) => [...p, s]), id))) return null;
    setLearnOutcome(run.outcome);
    setLearnPhase("done");
    return run;
  }

  async function runExtract(id: number, run: { steps: RunStep[]; outcome: string }): Promise<Skill | null> {
    setTrace([]);
    setSkill(null);
    setExtractPhase("running");
    const extracted =
      mode === "live"
        ? (await post<LiveExtractResponse>({ phase: "extract", prompt: pair.learn.prompt, ...run })).skill
        : pair.skill;
    for (const line of extractionTrace(run.steps, extracted)) {
      if (runId.current !== id) return null;
      setTrace((p) => [...p, line]);
      await sleep(delay);
    }
    if (runId.current !== id) return null;
    setSkill(extracted);
    setLibrary((lib) => [extracted, ...lib.filter((s) => s.name !== extracted.name)]);
    setExtractPhase("done");
    return extracted;
  }

  async function runReuse(id: number, variant: Variant, withSkill: Skill | null) {
    setReuseVariant(variant);
    setReuseSteps([]);
    setReuseOutcome(null);
    setReusePhase("running");
    const run =
      mode === "live"
        ? await post<LiveRunResponse>({
            phase: "run",
            prompt: pair.reuse.prompt,
            skill: variant === "warm" ? (withSkill ?? undefined) : undefined,
          })
        : { steps: variant === "warm" ? pair.reuse.warm : pair.reuse.cold, outcome: pair.reuse.outcome };
    if (!(await replay(run.steps, (s) => setReuseSteps((p) => [...p, s]), id))) return;
    setReuseOutcome(run.outcome);
    setMeasured((m) => ({ ...m, [variant]: statsOf(run.steps) }));
    setReusePhase("done");
  }

  async function guard(fn: (id: number) => Promise<void>) {
    const id = ++runId.current;
    setError(null);
    try {
      await fn(id);
    } catch (err) {
      if (runId.current !== id) return;
      setError(err instanceof Error ? err.message : String(err));
      setLearnPhase((p) => (p === "running" ? "idle" : p));
      setExtractPhase((p) => (p === "running" ? "idle" : p));
      setReusePhase((p) => (p === "running" ? "idle" : p));
    }
  }

  const onLearn = () =>
    guard(async (id) => {
      setReuseSteps([]);
      setReusePhase("idle");
      setMeasured({});
      const run = await runLearn(id);
      if (run) await runExtract(id, run);
    });

  const onReuse = (variant: Variant) => guard((id) => runReuse(id, variant, skill));

  const onFullLoop = () =>
    guard(async (id) => {
      setReuseSteps([]);
      setReusePhase("idle");
      setMeasured({});
      const run = await runLearn(id);
      if (!run) return;
      const s = await runExtract(id, run);
      if (!s) return;
      await sleep(delay);
      await runReuse(id, "warm", s);
    });

  // Scripted mode always knows the cold baseline from the fixture; live mode only shows what actually ran.
  const coldStats = measured.cold ?? (mode === "scripted" ? statsOf(pair.reuse.cold) : undefined);
  const warmStats = measured.warm;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <Sparkles className="size-3.5 text-violet-500" /> Hermes-style learning loop
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Hermes Skill Loop</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Run a multi-step task, watch the agent distil a <span className="font-medium text-foreground">skill</span>{" "}
            from it, then reuse that skill on a related task — fewer steps, no repeated dead ends. Inspired by{" "}
            <a className="underline underline-offset-2" href={HERMES} target="_blank" rel="noreferrer">
              Nous Research Hermes Agent
            </a>{" "}
            (
            <a className="underline underline-offset-2" href={BOOKMARK} target="_blank" rel="noreferrer">
              bookmark
            </a>
            ).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border p-0.5 text-sm">
            {(["scripted", "live"] as const).map((m) => (
              <button
                key={m}
                disabled={busy || (m === "live" && !liveAvailable)}
                onClick={() => {
                  setMode(m);
                  reset();
                }}
                className={cn(
                  "rounded-md px-3 py-1 capitalize transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  mode === m ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setFast((f) => !f)}>
            <FastForward /> {fast ? "Fast" : "Normal"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => reset()}>
            <RotateCcw /> Reset
          </Button>
          <Button size="sm" disabled={busy} onClick={onFullLoop}>
            <Play /> Run full loop
          </Button>
        </div>
      </header>

      {!liveAvailable ? (
        <Alert className="mt-4 border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <TriangleAlert />
          <AlertTitle>Scripted mode — no API key on the server</AlertTitle>
          <AlertDescription className="text-amber-800 dark:text-amber-300">
            Runs, extracted skills and observations replay from <code>data/tasks.ts</code>. Set{" "}
            <code>ANTHROPIC_API_KEY</code> to enable Live mode, where Claude runs each task in a simulated sandbox and
            distils the skill itself. Tools are never really executed.
          </AlertDescription>
        </Alert>
      ) : (
        mode === "live" && (
          <Alert className="mt-4">
            <Sparkles />
            <AlertTitle>Live mode · {model}</AlertTitle>
            <AlertDescription>
              Claude plans each run and writes the skill via <code>/api/loop</code>. Tools are simulated: observations
              are model-written, nothing executes.
            </AlertDescription>
          </Alert>
        )
      )}
      {error && (
        <Alert variant="destructive" className="mt-4">
          <TriangleAlert />
          <AlertTitle>Run failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-6">
          <section>
            <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Task pairs</h2>
            <div className="space-y-2">
              {TASKS.map((t) => (
                <button
                  key={t.id}
                  disabled={busy}
                  onClick={() => reset(t.id)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left text-sm transition-colors disabled:cursor-not-allowed",
                    t.id === pairId ? "border-foreground/40 bg-muted" : "hover:bg-muted/60",
                  )}
                >
                  <div className="text-xs text-muted-foreground">{t.domain}</div>
                  <div className="mt-0.5 font-medium">{t.learn.title}</div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <ArrowRight className="size-3 shrink-0" /> {t.reuse.title}
                  </div>
                </button>
              ))}
            </div>
          </section>
          <section>
            <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Skill library <span className="normal-case">(this session)</span>
            </h2>
            {library.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                Empty. Skills land here after a run is distilled.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {library.map((s) => (
                  <li key={s.name} className="rounded-lg border bg-violet-50/60 p-2 text-xs dark:bg-violet-950/20">
                    <div className="flex items-center gap-1.5 font-mono font-medium">
                      <BookOpen className="size-3 text-violet-500" /> {s.name}
                    </div>
                    <div className="mt-0.5 text-muted-foreground">{s.steps.length} steps · {s.tools.join(", ")}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        <div className="min-w-0 space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            {/* 1 · Learn */}
            <Card>
              <CardHeader>
                <StageTitle n={1} title="Run the task" phase={learnPhase} />
                <CardDescription>
                  <span className="font-medium text-foreground">{pair.learn.title}</span> — “{pair.learn.prompt}”
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Timeline steps={learnSteps} running={learnPhase === "running"} boxRef={learnBox} />
                {learnOutcome && <Outcome text={learnOutcome} />}
                <div className="flex items-center justify-between gap-2">
                  <StatsLine steps={learnSteps} />
                  <Button size="sm" variant="outline" disabled={busy} onClick={onLearn}>
                    <Play /> {learnPhase === "done" ? "Re-run" : "Run task"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 2 · Extract */}
            <Card className={cn(skill && "ring-violet-500/50")}>
              <CardHeader>
                <StageTitle n={2} title="Extract a skill" phase={extractPhase} />
                <CardDescription>After a complex run, the agent writes its procedure down as a reusable skill.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {trace.length === 0 && (
                  <Empty>Waiting for a finished run. Skills are distilled from what actually worked.</Empty>
                )}
                {trace.length > 0 && (
                  <ol className="space-y-1 text-xs text-muted-foreground">
                    {trace.map((t, i) => (
                      <li key={i} className="flex items-start gap-1.5 animate-in fade-in slide-in-from-left-1">
                        <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-violet-500" /> {t}
                      </li>
                    ))}
                  </ol>
                )}
                {skill && <SkillCard skill={skill} activeStep={activeSkillStep} />}
              </CardContent>
            </Card>
          </div>

          {/* 3 · Reuse */}
          <Card className={cn(!skill && "opacity-60")}>
            <CardHeader>
              <StageTitle n={3} title="Reuse on a related task" phase={reusePhase} />
              <CardDescription>
                <span className="font-medium text-foreground">{pair.reuse.title}</span> — “{pair.reuse.prompt}”
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[1fr_300px]">
              <div className="min-w-0 space-y-3">
                {reuseSteps.length > 0 && (
                  <Badge
                    variant="outline"
                    className={cn(reuseVariant === "warm" ? "border-violet-500/50 text-violet-700 dark:text-violet-300" : "")}
                  >
                    {reuseVariant === "warm" ? <BookOpen /> : <Snowflake />}
                    {reuseVariant === "warm" ? `With skill: ${skill?.name}` : "Cold start (no skill)"}
                  </Badge>
                )}
                <Timeline steps={reuseSteps} running={reusePhase === "running"} boxRef={reuseBox} />
                {reuseOutcome && <Outcome text={reuseOutcome} />}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={busy || !skill} onClick={() => onReuse("warm")}>
                    <BookOpen /> Run with skill
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy || !skill} onClick={() => onReuse("cold")}>
                    <Snowflake /> Run cold
                  </Button>
                </div>
              </div>
              <Compare cold={coldStats} warm={warmStats} coldMeasured={Boolean(measured.cold)} />
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Simulated, Hermes-shaped harness — not the Hermes Agent runtime. Tool calls are never executed; scripted
            observations come from <code>data/tasks.ts</code>. Skill format mirrors Hermes&apos;{" "}
            <code>~/.hermes/skills/&lt;name&gt;/SKILL.md</code>.
          </p>
        </div>
      </div>
    </main>
  );
}

function StageTitle({ n, title, phase }: { n: number; title: string; phase: Phase }) {
  return (
    <CardTitle className="flex items-center gap-2">
      <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-[11px] text-background">
        {n}
      </span>
      {title}
      {phase === "running" && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      {phase === "done" && <CheckCircle2 className="size-4 text-emerald-500" />}
    </CardTitle>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">{children}</p>;
}

function Outcome({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
      <span className="font-medium">Outcome:</span> {text}
    </div>
  );
}

function Timeline({
  steps,
  running,
  boxRef,
}: {
  steps: RunStep[];
  running: boolean;
  boxRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (steps.length === 0 && !running) return <Empty>No run yet.</Empty>;
  return (
    <div ref={boxRef} className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
      {steps.map((s, i) => {
        const Icon = KIND_ICON[s.kind];
        return (
          <div
            key={i}
            className={cn(
              "flex gap-2.5 rounded-md border-l-2 border-transparent px-2 py-1.5 text-xs animate-in fade-in slide-in-from-bottom-1",
              s.skillStep && "border-violet-500 bg-violet-50 dark:bg-violet-950/30",
              s.kind === "skill" && "border-violet-500 bg-violet-100 dark:bg-violet-900/40",
              s.wasted && "border-red-400 bg-red-50/70 dark:bg-red-950/20",
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 size-3.5 shrink-0 text-muted-foreground",
                s.kind === "answer" && "text-emerald-500",
                (s.kind === "skill" || s.skillStep) && "text-violet-500",
                s.wasted && "text-red-500",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={cn("font-medium", s.kind === "tool" && "font-mono")}>{s.label}</span>
                {s.wasted && (
                  <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
                    dead end
                  </Badge>
                )}
                {s.skillStep && (
                  <Badge className="h-4 bg-violet-600 px-1.5 text-[10px] text-white">skill step {s.skillStep}</Badge>
                )}
              </div>
              <div className="mt-0.5 text-muted-foreground">{s.detail}</div>
            </div>
            {s.tool && <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{s.tool}</span>}
          </div>
        );
      })}
      {running && (
        <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> working…
        </div>
      )}
    </div>
  );
}

function StatsLine({ steps }: { steps: RunStep[] }) {
  if (steps.length === 0) return <span />;
  const s = statsOf(steps);
  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      {s.steps} events · {s.toolCalls} tool calls · {s.wasted} dead end{s.wasted === 1 ? "" : "s"} · ~{s.tokens.toLocaleString()} tok
    </span>
  );
}

function SkillCard({ skill, activeStep }: { skill: Skill; activeStep?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-violet-500/40 animate-in fade-in zoom-in-95">
      <div className="flex items-center justify-between gap-2 border-b border-violet-500/20 bg-violet-50 px-3 py-1.5 font-mono text-[11px] text-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
        <span className="truncate">~/.hermes/skills/{skill.name}/SKILL.md</span>
        <Badge className="h-4 bg-violet-600 px-1.5 text-[10px] text-white">new skill</Badge>
      </div>
      <div className="space-y-3 p-3 text-xs">
        <div>
          <div className="font-mono text-sm font-semibold">{skill.name}</div>
          <div className="text-muted-foreground">{skill.description}</div>
        </div>
        <div>
          <div className="mb-0.5 font-medium">When to use</div>
          <div className="text-muted-foreground">{skill.trigger}</div>
        </div>
        <div>
          <div className="mb-1 font-medium">Procedure</div>
          <ol className="space-y-1">
            {skill.steps.map((s, i) => (
              <li
                key={i}
                className={cn(
                  "flex gap-2 rounded px-1.5 py-0.5 transition-colors",
                  activeStep === i + 1 && "bg-violet-600 text-white",
                )}
              >
                <span className="font-mono opacity-60">{i + 1}.</span> {s}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <div className="mb-1 font-medium">Pitfalls</div>
          <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
            {skill.pitfalls.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-1">
          {skill.tools.map((t) => (
            <Badge key={t} variant="outline" className="font-mono text-[10px]">
              {t}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function Compare({ cold, warm, coldMeasured }: { cold?: RunStats; warm?: RunStats; coldMeasured: boolean }) {
  const rows: { label: string; key: keyof RunStats }[] = [
    { label: "Events", key: "steps" },
    { label: "Tool calls", key: "toolCalls" },
    { label: "Dead ends", key: "wasted" },
    { label: "Tokens (est.)", key: "tokens" },
  ];
  return (
    <div className="self-start rounded-lg border p-3 text-xs">
      <div className="mb-2 font-medium">Cold start vs. with skill</div>
      <table className="w-full tabular-nums">
        <thead className="text-muted-foreground">
          <tr>
            <th className="pb-1 text-left font-normal" />
            <th className="pb-1 text-right font-normal">
              <Snowflake className="inline size-3" /> cold
            </th>
            <th className="pb-1 text-right font-normal">
              <BookOpen className="inline size-3" /> skill
            </th>
            <th className="pb-1 text-right font-normal">Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, key }) => {
            const c = cold?.[key];
            const w = warm?.[key];
            const delta = c != null && w != null && c > 0 ? Math.round(((w - c) / c) * 100) : null;
            return (
              <tr key={key} className="border-t">
                <td className="py-1.5">{label}</td>
                <td className="py-1.5 text-right">{c?.toLocaleString() ?? "—"}</td>
                <td className="py-1.5 text-right font-medium text-violet-700 dark:text-violet-300">
                  {w?.toLocaleString() ?? "—"}
                </td>
                <td className={cn("py-1.5 text-right", delta != null && delta < 0 && "text-emerald-600")}>
                  {delta == null ? "" : `${delta > 0 ? "+" : ""}${delta}%`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {!cold
          ? "Run cold to fill the baseline column."
          : coldMeasured
            ? "Both columns measured from runs in this session."
            : "Cold column is the fixture baseline until you Run cold."}
      </p>
    </div>
  );
}
