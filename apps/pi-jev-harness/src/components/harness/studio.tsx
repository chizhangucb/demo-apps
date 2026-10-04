'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, Bot, CheckCircle2, CircleDot, Cpu, Play, RotateCcw, ShieldAlert, ShieldCheck, Wrench, Zap } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { pct, runHarness } from '@/lib/harness'
import { liveDecider } from '@/lib/live'
import { DEFAULT_POLICY, MODELS, QUESTIONS, SCORE_MAX } from '@/lib/policy'
import { SEED_TASKS, agentScriptFor, scriptedDecider } from '@/lib/scripted'
import type { Mode, Policy, StatusResponse, TimelineEvent } from '@/lib/types'
import { cn } from '@/lib/utils'

const STEP_MS = 750
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const POLICY_FIELDS: { key: keyof Policy; label: string; hint: string }[] = [
  { key: 'modelConfidenceFloor', label: 'Model confidence floor', hint: 'Below → route to powerful' },
  { key: 'complexityCutoff', label: 'Complexity cutoff', hint: 'At or above → route to powerful' },
  { key: 'toolDenyCutoff', label: 'Tool deny cutoff', hint: 'Unsafe ≥ cutoff → deny the call' },
  { key: 'doneCutoff', label: 'Done cutoff', hint: 'Score ≥ cutoff → hand back' },
]

export function Studio() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [selected, setSelected] = useState<string | null>(SEED_TASKS[0].id)
  const [task, setTask] = useState(SEED_TASKS[0].task)
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY)
  const [mode, setMode] = useState<Mode>('scripted')
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [running, setRunning] = useState(false)
  const [source, setSource] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const runId = useRef(0)

  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json() as Promise<StatusResponse>)
      .then(setStatus)
      .catch(() => setStatus({ live: false, provider: null }))
  }, [])

  const liveReady = Boolean(status?.live)

  async function run() {
    const id = ++runId.current
    const decider = mode === 'live' && status?.provider ? liveDecider(status.provider) : scriptedDecider()
    setEvents([])
    setError(null)
    setSource(decider.source)
    setRunning(true)
    try {
      await sleep(250)
      await runHarness(task, agentScriptFor(task), policy, decider, async (e) => {
        if (id !== runId.current) return
        setEvents((prev) => [...prev, e])
        if (decider.source === 'scripted') await sleep(STEP_MS)
      })
    } catch (err) {
      if (id === runId.current) setError(err instanceof Error ? err.message : 'Run failed')
    } finally {
      if (id === runId.current) setRunning(false)
    }
  }

  function pickSeed(seedId: string) {
    const seed = SEED_TASKS.find((s) => s.id === seedId)!
    setSelected(seed.id)
    setTask(seed.task)
    setEvents([])
  }

  const model = events.find((e) => e.kind === 'model')
  const tools = events.filter((e) => e.kind === 'tool')
  const done = events.find((e) => e.kind === 'done')

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bot className="size-4" /> Pi-shaped harness · Jev control plane
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Pi + Jev Harness</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            One agent loop, three cheap Jev decisions: <b>pick a model</b> before the request, <b>allow or deny</b> each tool call,
            and <b>score whether the answer is done</b> before handing back.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-1 text-sm">
          {(['scripted', 'live'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              disabled={m === 'live' && !liveReady}
              onClick={() => setMode(m)}
              className={cn(
                'rounded-md px-3 py-1 capitalize transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                mode === m ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </header>

      {status && !liveReady && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Scripted mode: no Jev key on the server</AlertTitle>
          <AlertDescription>
            Runs use canned Jev probabilities and verdicts (zero network). Set <code>OPENROUTER_API_KEY</code> or <code>TYPESAFE_API_KEY</code>{' '}
            server-side to unlock Live mode, which asks real Jev the same three questions.
          </AlertDescription>
        </Alert>
      )}
      {liveReady && (
        <Alert>
          <Zap />
          <AlertTitle>Live Jev available via {status?.provider}</AlertTitle>
          <AlertDescription>Switch to Live to send the three gate questions to real Jev. The agent plan and tools stay simulated.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Task</CardTitle>
              <CardDescription>Pick a seeded task or paste your own (pasted tasks get a canned agent plan).</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                {SEED_TASKS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pickSeed(s.id)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                      selected === s.id && 'border-primary bg-muted',
                    )}
                  >
                    <div className="font-medium">{s.title}</div>
                    <div className="text-xs text-muted-foreground">{s.shape}</div>
                  </button>
                ))}
              </div>
              <Textarea
                value={task}
                rows={3}
                onChange={(e) => {
                  setTask(e.target.value)
                  setSelected(SEED_TASKS.find((s) => s.task === e.target.value.trim())?.id ?? null)
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Policy</CardTitle>
              <CardDescription>Nudge a threshold and re-run — the same Jev answers can flip verdicts.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {POLICY_FIELDS.map((f) => (
                <div key={f.key} className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{f.label}</span>
                    <span className="font-mono tabular-nums">{policy[f.key].toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[Math.round(policy[f.key] * 100)]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(v) => {
                      const n = Array.isArray(v) ? v[0] : v
                      setPolicy((p) => ({ ...p, [f.key]: n / 100 }))
                    }}
                  />
                  <span className="text-xs text-muted-foreground">{f.hint}</span>
                </div>
              ))}
              <div className="flex gap-2">
                <Button className="flex-1" onClick={run} disabled={running || !task.trim()}>
                  <Play /> {running ? 'Running…' : 'Run harness'}
                </Button>
                <Button variant="outline" onClick={() => setPolicy(DEFAULT_POLICY)} disabled={running}>
                  <RotateCcw /> Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <LoopStrip events={events} running={running} />
          {error && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>Run failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {events.length === 0 && !running && !error && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Press <b>Run harness</b> to watch the three gates fire.
              </CardContent>
            </Card>
          )}
          {source && events.length > 0 && (
            <div className="text-xs text-muted-foreground" data-testid={running ? 'run-active' : 'run-finished'}>
              Decisions: {source}
            </div>
          )}

          {model?.kind === 'model' && (
            <GateCard
              n={1}
              hook={model.hook}
              title="Model pick"
              icon={<Cpu className="size-4" />}
              question={`${QUESTIONS.model.tier} + ${QUESTIONS.model.complexity}`}
              verdict={<Badge>{MODELS[model.model]}</Badge>}
            >
              <ProbBar label="P(fast)" value={model.answer.probabilities.fast} />
              <ProbBar label="P(powerful)" value={model.answer.probabilities.powerful} />
              <ProbBar label="Confidence" value={model.answer.confidence} threshold={policy.modelConfidenceFloor} tone={model.answer.confidence < policy.modelConfidenceFloor ? 'warn' : 'ok'} />
              <ProbBar label={`Complexity (${model.answer.complexity.toFixed(1)}/${SCORE_MAX})`} value={model.answer.complexity / SCORE_MAX} threshold={policy.complexityCutoff} tone={model.answer.complexity / SCORE_MAX >= policy.complexityCutoff ? 'warn' : 'ok'} />
              <p className="text-xs text-muted-foreground">{model.reason}</p>
            </GateCard>
          )}

          {tools.map((t, i) =>
            t.kind === 'tool' ? (
              <GateCard
                key={i}
                n={2}
                hook={t.hook}
                title={`Tool gate · ${t.call.tool}`}
                icon={<Wrench className="size-4" />}
                question={QUESTIONS.tool.unsafe}
                verdict={
                  t.verdict === 'allow' ? (
                    <Badge variant="secondary" className="gap-1"><ShieldCheck className="size-3" /> allow</Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1"><ShieldAlert className="size-3" /> deny</Badge>
                  )
                }
              >
                <code className="block rounded bg-muted px-2 py-1 text-xs">{t.call.tool}({t.call.args})</code>
                <ProbBar label="P(unsafe)" value={t.answer.noul} threshold={policy.toolDenyCutoff} tone={t.verdict === 'deny' ? 'bad' : 'ok'} />
                <pre className="whitespace-pre-wrap text-xs text-muted-foreground">→ {t.result}</pre>
              </GateCard>
            ) : null,
          )}

          {done?.kind === 'done' && (
            <GateCard
              n={3}
              hook={done.hook}
              title="Done check"
              icon={<CheckCircle2 className="size-4" />}
              question={QUESTIONS.done.score}
              verdict={
                done.verdict === 'done' ? (
                  <Badge className="gap-1"><CheckCircle2 className="size-3" /> done</Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1"><RotateCcw className="size-3" /> keep going</Badge>
                )
              }
            >
              <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">{done.draft}</div>
              <ProbBar label={`Done score (${done.answer.score.toFixed(1)}/${SCORE_MAX})`} value={done.normalized} threshold={policy.doneCutoff} tone={done.verdict === 'done' ? 'ok' : 'bad'} />
              <p className="text-xs text-muted-foreground">{done.note}</p>
            </GateCard>
          )}
        </div>
      </div>

      <footer className="border-t pt-4 text-xs text-muted-foreground">
        Thin Pi-shaped runner (hooks <code>before_agent_start</code> · <code>tool_call</code> · <code>agent_end</code>); no Pi CLI, no real tools.
        Based on Elvis Saravia&apos;s{' '}
        <a className="underline" href="https://academy.dair.ai/resources/jev-decisions-in-a-pi-sdk-harness" target="_blank" rel="noreferrer">
          Building a Custom Harness with Pi and Jev
        </a>{' '}
        (DAIR.AI Academy) ·{' '}
        <a className="underline" href="https://x.com/omarsar0/status/2102762406204076532" target="_blank" rel="noreferrer">
          bookmark
        </a>
      </footer>
    </div>
  )
}

function LoopStrip({ events, running }: { events: TimelineEvent[]; running: boolean }) {
  const steps = [
    { key: 'model', label: 'before_agent_start', sub: 'model pick' },
    { key: 'tool', label: 'tool_call', sub: 'tool gate' },
    { key: 'done', label: 'agent_end', sub: 'done check' },
  ] as const
  const reached = (k: string) => events.some((e) => e.kind === k)
  const current = !running ? undefined : !reached('model') ? 'model' : !reached('done') ? 'tool' : undefined
  return (
    <div className="flex items-center gap-2 overflow-x-auto rounded-lg border p-3 text-xs">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div
            className={cn(
              'flex items-center gap-2 rounded-md border px-2 py-1',
              reached(s.key) && 'border-primary bg-primary/10',
              current === s.key && 'animate-pulse border-primary',
            )}
          >
            <CircleDot className="size-3" />
            <div>
              <div className="font-mono">{s.label}</div>
              <div className="text-muted-foreground">Gate {i + 1} · {s.sub}</div>
            </div>
          </div>
          {i < steps.length - 1 && <ArrowRight className="size-3 shrink-0 text-muted-foreground" />}
        </div>
      ))}
    </div>
  )
}

function GateCard(props: { n: number; hook: string; title: string; icon: React.ReactNode; question: string; verdict: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {props.icon} Gate {props.n} · {props.title}
          </CardTitle>
          {props.verdict}
        </div>
        <CardDescription>
          <span className="font-mono">{props.hook}</span> — “{props.question}”
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">{props.children}</CardContent>
    </Card>
  )
}

function ProbBar({ label, value, threshold, tone = 'neutral' }: { label: string; value: number; threshold?: number; tone?: 'ok' | 'warn' | 'bad' | 'neutral' }) {
  const color = { ok: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-red-500', neutral: 'bg-primary/60' }[tone]
  return (
    <div className="grid grid-cols-[9rem_1fr_3rem] items-center gap-2 text-xs">
      <span className="truncate text-muted-foreground">{label}</span>
      <div className="relative h-2 rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${Math.min(100, value * 100)}%` }} />
        {threshold !== undefined && (
          <div className="absolute -top-1 h-4 w-0.5 bg-foreground" style={{ left: `${threshold * 100}%` }} title={`threshold ${pct(threshold)}`} />
        )}
      </div>
      <span className="text-right font-mono tabular-nums">{pct(value)}</span>
    </div>
  )
}
