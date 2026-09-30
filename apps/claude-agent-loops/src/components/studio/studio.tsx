"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleDashed,
  Clock,
  Eye,
  Hammer,
  Loader2,
  Play,
  RotateCcw,
  Square,
  TriangleAlert,
  XCircle,
  Zap,
} from "lucide-react";
import { TASKS } from "@data/tasks";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { decide, feedbackFrom, LOOP_TYPES, STOP_LABEL } from "@/lib/harness";
import { checkAll, isVerified } from "@/lib/verify";
import { cn } from "@/lib/utils";
import type {
  CriterionResult,
  LiveActResponse,
  LiveJudgeResponse,
  LoopType,
  Mode,
  ScriptedStep,
  StopReason,
  Task,
  TurnRecord,
} from "@/lib/types";

const BOOKMARK = "https://x.com/ClaudeDevs/status/2074208949205881033";
const IDLE_TOKENS = 40;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type RunState = "idle" | "running" | "done";

async function post<T>(body: unknown): Promise<T> {
  const res = await fetch("/api/step", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

function fmtClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Studio({ liveAvailable, model }: { liveAvailable: boolean; model: string }) {
  const [taskId, setTaskId] = useState(TASKS[0].id);
  const task = TASKS.find((t) => t.id === taskId) as Task;
  const [loopType, setLoopType] = useState<LoopType>(task.recommended);
  const [goal, setGoal] = useState(task.goal);
  const [criteriaText, setCriteriaText] = useState(task.criteria.join("\n"));
  const [maxTurns, setMaxTurns] = useState(task.maxTurns);
  const [budget, setBudget] = useState(task.budget);
  const [mode, setMode] = useState<Mode>("scripted");
  const [speed, setSpeed] = useState<"normal" | "fast">("normal");

  const [records, setRecords] = useState<TurnRecord[]>([]);
  const [state, setState] = useState<RunState>("idle");
  const [stop, setStop] = useState<{ reason: StopReason; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  const criteria = useMemo(
    () => criteriaText.split("\n").map((l) => l.trim()).filter(Boolean),
    [criteriaText],
  );

  function pickTask(t: Task) {
    if (state === "running") return;
    setTaskId(t.id);
    setLoopType(t.recommended);
    setGoal(t.goal);
    setCriteriaText(t.criteria.join("\n"));
    setMaxTurns(t.maxTurns);
    setBudget(t.budget);
    reset();
  }

  function reset() {
    setRecords([]);
    setStop(null);
    setError(null);
    setState("idle");
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [records.length]);

  const turnsUsed = records.filter((r) => r.kind === "act").length;
  const tokensUsed = records.reduce((s, r) => s + r.tokens, 0);
  const clock = records.at(-1)?.clock ?? 0;
  const lastEval = [...records].reverse().find((r) => r.results)?.results;
  const passing = lastEval?.filter((r) => r.status === "pass").length ?? 0;

  async function run() {
    reset();
    setState("running");
    cancelRef.current = false;
    const beat = mode === "live" ? 150 : speed === "fast" ? 180 : 650;
    const live = mode === "live";
    const steps = task.steps;
    const log: TurnRecord[] = [];
    const push = (r: TurnRecord) => {
      log.push(r);
      setRecords([...log]);
    };
    const patch = (r: Partial<TurnRecord>) => {
      Object.assign(log[log.length - 1], r);
      setRecords([...log]);
    };
    let clk = 0;
    let used = 0;
    let turn = 0;
    let prevOutput: string | undefined;
    let feedback: string | undefined;

    const finish = (reason: StopReason, text: string) => {
      setStop({ reason, text });
      setState("done");
    };

    try {
      for (let i = 0; ; i++) {
        if (cancelRef.current) return finish("cancelled", "Stopped by you.");
        // In live mode the fixture only supplies the world (observations / triggers); past its end we reuse the last tick.
        const step: ScriptedStep | undefined = steps[i] ?? (live && loopType !== "proactive" ? steps.at(-1) : undefined);
        if (!step) return finish(loopType === "proactive" ? "window-closed" : "script-exhausted", "Nothing left to replay.");

        // Proactive: idle watch ticks until the trigger fires.
        if (loopType === "proactive") {
          for (let k = 0; k < (step.idleBefore ?? 0); k++) {
            clk += task.intervalSec || 60;
            used += IDLE_TOKENS;
            push({ turn: turn + 1, kind: "idle", clock: clk, tokens: IDLE_TOKENS, phase: "done" });
            await sleep(beat);
            if (cancelRef.current) return finish("cancelled", "Stopped by you.");
          }
        }
        if (loopType === "time" && i > 0) clk += task.intervalSec || 30;
        if (loopType === "proactive" && i > 0 && !step.idleBefore) clk += task.intervalSec || 60;

        turn++;
        const trigger =
          loopType === "proactive" ? step.trigger ?? (i === 0 ? "wake: task assigned" : "wake: verifier feedback posted") : undefined;
        push({ turn, kind: "act", clock: clk, trigger, observation: step.observation, tokens: 0, phase: "act" });

        // ACT
        let act: LiveActResponse;
        if (live) {
          act = await post<LiveActResponse>({
            phase: "act",
            loopType,
            goal,
            criteria,
            turn,
            observation: step.observation,
            trigger,
            previousOutput: prevOutput,
            feedback,
          });
        } else {
          await sleep(beat);
          act = { act: step.act, output: step.output, agentDone: step.agentDone, tokens: step.tokens };
        }
        used += act.tokens;
        if (loopType !== "time" && loopType !== "proactive") clk += Math.max(4, Math.round(act.tokens / 60));
        patch({ act: act.act, output: act.output, agentDone: act.agentDone, tokens: act.tokens, clock: clk, phase: "evaluate" });
        await sleep(beat);

        // EVALUATE: local rules first; in live mode Claude judges whatever the rules can't.
        let results: CriterionResult[] = checkAll(criteria, act.output);
        const unchecked = results.filter((r) => r.status === "unchecked").map((r) => r.criterion);
        let judgeTokens = 0;
        if (live && unchecked.length) {
          const j = await post<LiveJudgeResponse>({ phase: "judge", goal, criteria: unchecked, output: act.output });
          judgeTokens = j.tokens;
          results = results.map((r) => {
            if (r.status !== "unchecked") return r;
            const hit = j.results.find((x) => x.criterion === r.criterion) ?? j.results[unchecked.indexOf(r.criterion)];
            return hit ? { criterion: r.criterion, status: hit.pass ? "pass" : "fail", note: hit.note, by: "claude" } : r;
          });
        }
        used += judgeTokens;
        patch({ results, tokens: act.tokens + judgeTokens, phase: "decide" });
        await sleep(beat);

        // CONTINUE / STOP
        const d = decide({
          loopType,
          results,
          agentDone: act.agentDone,
          turn,
          maxTurns,
          tokensUsed: used,
          budget,
          moreSteps: live ? loopType !== "proactive" || i + 1 < steps.length : i + 1 < steps.length,
          intervalSec: task.intervalSec || 30,
        });
        patch({ decision: d, phase: "done" });
        if (d.action === "stop") return finish(d.stop!, d.reason);
        prevOutput = act.output;
        feedback = feedbackFrom(results);
        await sleep(beat);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      finish("error", "The live step failed — see the error above.");
    }
  }

  const running = state === "running";
  const doneOk = stop?.reason === "verified" || (stop?.reason === "agent-done" && lastEval && isVerified(lastEval));
  const loopMeta = LOOP_TYPES.find((l) => l.id === loopType)!;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Claude Agent Loops</h1>
          <p className="text-sm text-muted-foreground">
            Turn · Goal · Time · Proactive — one harness, four ways to decide when an agent stops. Inspired by{" "}
            <a className="underline underline-offset-2" href={BOOKMARK} target="_blank" rel="noreferrer">
              @ClaudeDevs
            </a>
            .
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-1 text-sm">
          {(["scripted", "live"] as const).map((m) => (
            <button
              key={m}
              disabled={running || (m === "live" && !liveAvailable)}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-md px-3 py-1 capitalize transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                mode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </header>

      {!liveAvailable ? (
        <Alert>
          <TriangleAlert />
          <AlertTitle>Scripted mode — no ANTHROPIC_API_KEY on the server</AlertTitle>
          <AlertDescription>
            Act steps replay canned fixtures; Evaluate is the real local rule verifier. Set ANTHROPIC_API_KEY to let
            Claude take each turn and judge free-form criteria.
          </AlertDescription>
        </Alert>
      ) : mode === "live" ? (
        <Alert>
          <Zap />
          <AlertTitle>Live mode — Claude ({model}) takes every Act step</AlertTitle>
          <AlertDescription>
            Observations and triggers still come from the task fixture, so the fake deploy and alert stream stay
            deterministic. Each turn costs real tokens.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        {/* Config */}
        <Card>
          <CardHeader>
            <CardTitle>Loop setup</CardTitle>
            <CardDescription>Pick a canned task, a loop type, then Run.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label>Task</Label>
              <div className="flex flex-col gap-1.5">
                {TASKS.map((t) => (
                  <button
                    key={t.id}
                    disabled={running}
                    onClick={() => pickTask(t)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:opacity-60",
                      t.id === taskId ? "border-primary bg-primary/5" : "hover:bg-muted",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 font-medium">
                      {t.title}
                      <Badge variant="outline" className="capitalize">
                        {t.recommended}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{t.blurb}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Loop type</Label>
              <div className="grid grid-cols-4 gap-1 rounded-lg border p-1">
                {LOOP_TYPES.map((l) => (
                  <button
                    key={l.id}
                    disabled={running}
                    onClick={() => setLoopType(l.id)}
                    className={cn(
                      "rounded-md px-2 py-1.5 text-sm transition-colors disabled:opacity-60",
                      loopType === l.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {loopMeta.summary} <span className="font-medium text-foreground">Stops when {loopMeta.stopsWhen}.</span>
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="goal">Goal</Label>
              <Textarea id="goal" rows={3} value={goal} disabled={running} onChange={(e) => setGoal(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="criteria">Verification criteria (one per line)</Label>
              <Textarea
                id="criteria"
                rows={5}
                className="font-mono text-xs"
                value={criteriaText}
                disabled={running}
                onChange={(e) => setCriteriaText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Local rules: <code>Contains &quot;x&quot;</code>, <code>No &quot;x&quot;</code>,{" "}
                <code>Headline at most N words</code>. Anything else is judged by Claude in live mode.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="turns">Max turns</Label>
                <Input
                  id="turns"
                  type="number"
                  min={1}
                  max={20}
                  value={maxTurns}
                  disabled={running}
                  onChange={(e) => setMaxTurns(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="budget">Token budget</Label>
                <Input
                  id="budget"
                  type="number"
                  min={500}
                  step={500}
                  value={budget}
                  disabled={running}
                  onChange={(e) => setBudget(Math.max(100, Number(e.target.value) || 100))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {running ? (
                <Button variant="destructive" className="flex-1" onClick={() => (cancelRef.current = true)}>
                  <Square /> Stop
                </Button>
              ) : (
                <Button className="flex-1" onClick={run} disabled={!goal.trim() || criteria.length === 0}>
                  <Play /> Run {loopMeta.label.toLowerCase()} loop
                </Button>
              )}
              <Button variant="outline" onClick={reset} disabled={running || records.length === 0} aria-label="Reset">
                <RotateCcw />
              </Button>
              {mode === "scripted" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSpeed(speed === "fast" ? "normal" : "fast")}
                  title="Replay speed"
                >
                  {speed === "fast" ? "Fast" : "1×"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Scoreboard + timeline */}
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-[1fr_1.3fr_auto_auto_1.4fr] md:items-center md:gap-6">
              <Meter label="Turns" value={turnsUsed} max={maxTurns} text={`${turnsUsed} / ${maxTurns}`} />
              <Meter
                label="Budget"
                value={tokensUsed}
                max={budget}
                text={`${tokensUsed.toLocaleString()} / ${budget.toLocaleString()}`}
              />
              <Stat label="Sim clock" value={fmtClock(clock)} icon={<Clock className="size-3.5" />} />
              <Stat
                label="Checks"
                value={lastEval ? `${passing} / ${lastEval.length}` : `– / ${criteria.length}`}
                icon={<CheckCircle2 className="size-3.5" />}
              />
              <div className="col-span-2 flex justify-start md:col-span-1 md:justify-end">
                {state === "idle" && <Badge variant="outline">Ready</Badge>}
                {running && (
                  <Badge variant="secondary" className="gap-1">
                    <Loader2 className="size-3 animate-spin" /> Running
                  </Badge>
                )}
                {state === "done" && stop && (
                  <Badge
                    data-testid="done-badge"
                    className={cn(
                      "gap-1 px-3 py-1 text-sm",
                      doneOk
                        ? "bg-emerald-600 text-white"
                        : stop.reason === "cancelled" || stop.reason === "error"
                          ? "bg-muted text-foreground"
                          : "bg-amber-500 text-white",
                    )}
                  >
                    {doneOk ? <CheckCircle2 className="size-4" /> : <TriangleAlert className="size-4" />}
                    Done · {STOP_LABEL[stop.reason]}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {error && (
            <Alert variant="destructive">
              <XCircle />
              <AlertTitle>Live step failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card className="min-h-[420px]">
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Act → Evaluate → Continue / Stop, one row per turn.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {records.length === 0 && (
                <div className="flex h-60 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground">
                  <CircleDashed className="size-6" />
                  Hit Run to start the {loopMeta.label.toLowerCase()} loop.
                </div>
              )}
              {records.map((r, idx) =>
                r.kind === "idle" ? (
                  <div key={idx} className="flex items-center gap-2 pl-2 text-xs text-muted-foreground">
                    <Eye className="size-3.5" /> {fmtClock(r.clock)} · watching — no trigger, stay idle (+{r.tokens} tok)
                  </div>
                ) : (
                  <TurnCard key={idx} r={r} loopType={loopType} />
                ),
              )}
              {stop && (
                <div
                  className={cn(
                    "rounded-lg border px-4 py-3 text-sm",
                    doneOk ? "border-emerald-600/40 bg-emerald-600/5" : "border-amber-500/40 bg-amber-500/5",
                  )}
                >
                  <span className="font-medium">Loop stopped: {STOP_LABEL[stop.reason]}.</span> {stop.text}
                </div>
              )}
              <div ref={endRef} />
            </CardContent>
          </Card>
        </div>
      </div>

      <footer className="pb-4 text-xs text-muted-foreground">
        Simulated local harness — no Claude Code <code>/goal</code> or <code>/loop</code> integration. Source bookmark:{" "}
        <a className="underline underline-offset-2" href={BOOKMARK} target="_blank" rel="noreferrer">
          {BOOKMARK}
        </a>
      </footer>
    </div>
  );
}

function Meter({ label, value, max, text }: { label: string; value: number; max: number; text: string }) {
  const pct = Math.min(100, (value / Math.max(1, max)) * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono text-sm whitespace-nowrap tabular-nums">{text}</div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-amber-500" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="font-mono text-sm tabular-nums">{value}</div>
    </div>
  );
}

function Phase({ icon, title, active, children }: { icon: React.ReactNode; title: string; active?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-3 py-2">
      <div className="flex items-start gap-1.5 pt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {active ? <Loader2 className="size-3.5 animate-spin" /> : icon}
        {title}
      </div>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  );
}

function TurnCard({ r, loopType }: { r: TurnRecord; loopType: LoopType }) {
  const stopped = r.decision?.action === "stop";
  return (
    <div className="rounded-lg border px-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Turn {r.turn}</span>
        <span className="font-mono">
          t={fmtClock(r.clock)} · {r.tokens.toLocaleString()} tok
        </span>
      </div>
      {(r.trigger || (r.observation && loopType !== "goal")) && (
        <div className="flex flex-col gap-0.5 pt-2 text-xs text-muted-foreground">
          {r.trigger && (
            <div>
              <Zap className="mr-1 inline size-3" />
              {r.trigger}
            </div>
          )}
          {r.observation && (
            <div className="font-mono">
              <Eye className="mr-1 inline size-3" />
              {r.observation}
            </div>
          )}
        </div>
      )}
      <Phase icon={<Hammer className="size-3.5" />} title="Act" active={r.phase === "act"}>
        {r.act ? (
          <div className="flex flex-col gap-1.5">
            <div>
              {r.act}
              {r.agentDone && (
                <Badge variant="outline" className="ml-2 text-[10px]">
                  agent: done
                </Badge>
              )}
            </div>
            <pre className="whitespace-pre-wrap rounded-md bg-muted px-3 py-2 font-mono text-xs">{r.output}</pre>
          </div>
        ) : (
          <span className="text-muted-foreground">working…</span>
        )}
      </Phase>
      {r.phase !== "act" && (
        <Phase icon={<CheckCircle2 className="size-3.5" />} title="Evaluate" active={r.phase === "evaluate"}>
          {r.results ? (
            <ul className="flex flex-col gap-0.5">
              {r.results.map((c, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs">
                  {c.status === "pass" ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                  ) : c.status === "fail" ? (
                    <XCircle className="mt-0.5 size-3.5 shrink-0 text-red-500" />
                  ) : (
                    <CircleDashed className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span>
                    {c.criterion} <span className="text-muted-foreground">— {c.note}</span>
                    {c.by === "claude" && <span className="text-muted-foreground"> (Claude judge)</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-muted-foreground">checking criteria…</span>
          )}
        </Phase>
      )}
      {(r.phase === "decide" || r.phase === "done") && (
        <Phase
          icon={stopped ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
          title={stopped ? "Stop" : "Continue"}
          active={r.phase === "decide"}
        >
          {r.decision ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={cn(
                  stopped
                    ? r.decision.stop === "verified"
                      ? "bg-emerald-600 text-white"
                      : "bg-amber-500 text-white"
                    : "bg-sky-600 text-white",
                )}
              >
                {stopped ? `Stop · ${STOP_LABEL[r.decision.stop!]}` : "Continue"}
              </Badge>
              <span className="text-xs text-muted-foreground">{r.decision.reason}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">deciding…</span>
          )}
        </Phase>
      )}
    </div>
  );
}
