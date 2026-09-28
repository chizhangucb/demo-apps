'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Play, RotateCcw, UserRound, Zap } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { supportTriageWorkflow } from '@/lib/workflow'
import type { GraphNodeId, RunError, RunResponse, SeedTicket, StatusResponse, TraceEntry } from '@/lib/types'
import { RunTrace } from './run-trace'
import { WorkflowGraph, graphNodeOf, type NodeState } from './workflow-graph'

const STEP_MS = 850
const ALL_NODES: GraphNodeId[] = ['search', 'judge', 'investigate', 'resolve', 'escalate']

type Tab = 'trace' | 'dsl' | 'events'

export function Studio({ seeds }: { seeds: SeedTicket[] }) {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [selected, setSelected] = useState<string | undefined>(seeds[0]?.id)
  const [ticket, setTicket] = useState(seeds[0]?.ticket ?? '')
  const [live, setLive] = useState(false)
  const [running, setRunning] = useState(false)
  const [run, setRun] = useState<RunResponse | null>(null)
  const [shown, setShown] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('trace')
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json() as Promise<StatusResponse>)
      .then(setStatus)
      .catch(() => setStatus({ jev: null, anthropic: false, agentModel: null, live: false }))
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [])

  const visible: TraceEntry[] = useMemo(() => run?.trace.slice(0, shown) ?? [], [run, shown])
  const replaying = Boolean(run && shown < run.trace.length)
  const finished = Boolean(run && !replaying)

  const { states, path } = useMemo(() => {
    const states = Object.fromEntries(ALL_NODES.map((n) => [n, 'idle'])) as Record<GraphNodeId, NodeState>
    const path: GraphNodeId[] = []
    for (const e of visible) {
      const n = graphNodeOf(e)
      if (path[path.length - 1] !== n) path.push(n)
      states[n] = 'done'
    }
    if (running && path.length === 0) states.search = 'active'
    if (replaying && path.length > 0) states[path[path.length - 1]] = 'active'
    if (finished) for (const n of ALL_NODES) if (!path.includes(n)) states[n] = 'skipped'
    return { states, path }
  }, [visible, running, replaying, finished])

  const judge = visible.find((e): e is Extract<TraceEntry, { node: 'judge' }> => e.node === 'judge')

  function pick(seed: SeedTicket) {
    setSelected(seed.id)
    setTicket(seed.ticket)
  }

  async function start() {
    if (timer.current) clearInterval(timer.current)
    setRunning(true)
    setError(null)
    setRun(null)
    setShown(0)
    setTab('trace')
    try {
      const seed = seeds.find((s) => s.id === selected && s.ticket === ticket.trim())
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ticketId: seed?.id, ticket, live }),
      })
      const body = (await res.json()) as RunResponse | RunError
      if (!body.ok) throw new Error(body.error)
      // Brief pause so the first node visibly lights up even when the scripted run is instant.
      await new Promise((r) => setTimeout(r, 400))
      setRun(body)
      setShown(1)
      let n = 1
      timer.current = setInterval(() => {
        n += 1
        setShown(n)
        if (n >= body.trace.length && timer.current) clearInterval(timer.current)
      }, STEP_MS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed')
    } finally {
      setRunning(false)
    }
  }

  const liveAvailable = Boolean(status?.live)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-muted-foreground font-mono text-xs">AgentRun · support-triage workflow</p>
          <h1 className="text-2xl font-semibold tracking-tight">AgentRun Support-Triage Studio</h1>
          <p className="text-muted-foreground text-sm">
            tool search → Jev judge → optional agent investigate → resolve / escalate, run by the real{' '}
            <code className="font-mono">@parcha/agentrun-dsl</code> interpreter.
          </p>
        </div>
        <div className="flex gap-3 text-xs">
          <a className="underline underline-offset-4" href="https://github.com/Parcha-ai/agentrun" target="_blank" rel="noreferrer">
            Parcha-ai/agentrun
          </a>
          <a className="underline underline-offset-4" href="https://agentrun.ai/" target="_blank" rel="noreferrer">
            agentrun.ai
          </a>
        </div>
      </header>

      {status && !status.live && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Scripted mode — no live keys on the server</AlertTitle>
          <AlertDescription>
            Runs use canned tool hits, Jev judgments and agent notes (zero network). Set <code>OPENROUTER_API_KEY</code> or{' '}
            <code>TYPESAFE_API_KEY</code> for live Jev and <code>ANTHROPIC_API_KEY</code> for a live investigate agent.
          </AlertDescription>
        </Alert>
      )}
      {status?.live && (!status.jev || !status.anthropic) && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Partially live</AlertTitle>
          <AlertDescription>
            {status.jev ? `Jev via ${status.jev} is live` : 'Jev judge stays scripted (no OPENROUTER_API_KEY / TYPESAFE_API_KEY)'};{' '}
            {status.anthropic ? `investigate agent uses ${status.agentModel}` : 'investigate agent stays scripted (no ANTHROPIC_API_KEY)'}.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Ticket</CardTitle>
            <CardDescription>Pick a seeded ticket or paste your own.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              {seeds.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pick(s)}
                  className={`rounded-full border px-2.5 py-1 text-left text-xs transition-colors ${
                    selected === s.id && ticket === s.ticket ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'
                  }`}
                >
                  {s.title}
                  <span className="ml-1 font-mono opacity-60">{s.path}</span>
                </button>
              ))}
            </div>
            <Textarea
              value={ticket}
              onChange={(e) => {
                setTicket(e.target.value)
                setSelected(undefined)
              }}
              rows={6}
              placeholder="Paste a short support ticket…"
              className="text-sm"
            />
            <label className={`flex items-center gap-2 text-xs ${liveAvailable ? '' : 'text-muted-foreground'}`}>
              <input type="checkbox" checked={live && liveAvailable} disabled={!liveAvailable} onChange={(e) => setLive(e.target.checked)} />
              <Zap className="size-3.5" /> Live mode {liveAvailable ? '(server keys detected)' : '(needs server keys)'}
            </label>
            <Button onClick={start} disabled={running || replaying || !ticket.trim()} size="lg">
              {run && !replaying ? <RotateCcw /> : <Play />}
              {running ? 'Running…' : replaying ? 'Replaying trace…' : run ? 'Run again' : 'Run workflow'}
            </Button>
            {error && <p className="text-destructive text-xs">{error}</p>}
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Workflow graph
                {run && (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {run.mode} · {run.durationMs} ms · sha {run.workflowSha256.slice(0, 8)}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WorkflowGraph states={states} path={path} judge={judge} />
            </CardContent>
          </Card>

          <div className="grid min-w-0 gap-5 xl:grid-cols-[1fr_300px]">
            <Card className="min-w-0">
              <CardHeader>
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      ['trace', 'Run trace'],
                      ['dsl', 'Workflow DSL'],
                      ['events', 'Raw events'],
                    ] as const
                  ).map(([id, label]) => (
                    <Button key={id} size="sm" variant={tab === id ? 'secondary' : 'ghost'} onClick={() => setTab(id)}>
                      {label}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="min-w-0">
                {tab === 'trace' && <RunTrace entries={visible} />}
                {tab === 'dsl' && (
                  <pre className="bg-muted max-h-[420px] overflow-auto rounded-md p-3 font-mono text-[11px] leading-relaxed">
                    {JSON.stringify(supportTriageWorkflow.root, null, 2)}
                  </pre>
                )}
                {tab === 'events' && (
                  <pre className="bg-muted max-h-[420px] overflow-auto rounded-md p-3 font-mono text-[11px] leading-relaxed">
                    {run
                      ? run.events.map((e) => `${e.type.padEnd(20)} ${e.label}${e.detail ? `  ${JSON.stringify(e.detail).slice(0, 140)}` : ''}`).join('\n')
                      : 'Run the workflow to see the interpreter’s onEvent stream.'}
                  </pre>
                )}
              </CardContent>
            </Card>

            <Disposition run={finished ? run : null} pending={running || replaying} />
          </div>
        </div>
      </div>

      <footer className="text-muted-foreground text-xs">
        Inspired by{' '}
        <a className="underline" href="https://x.com/MiguelriosEN/status/2101029313906987422" target="_blank" rel="noreferrer">
          this bookmark
        </a>
        . Complements <code>jev-inbox-triage</code> (the Jev decision UI) — this app shows the AgentRun harness around it.
      </footer>
    </div>
  )
}

function Disposition({ run, pending }: { run: RunResponse | null; pending: boolean }) {
  if (!run) {
    return (
      <Card className="self-start">
        <CardHeader>
          <CardTitle>Disposition</CardTitle>
          <CardDescription>{pending ? 'Workflow running…' : 'Final outcome appears when the run completes.'}</CardDescription>
        </CardHeader>
      </Card>
    )
  }
  const d = run.disposition
  if (d.status === 'resolved') {
    return (
      <Card className="border-ok animate-in fade-in self-start border-2 duration-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="text-ok size-5" />
            {d.disposition === 'auto_resolved' ? 'Auto-resolved' : 'Resolved after investigation'}
          </CardTitle>
          <CardDescription className="font-mono text-xs">status complete · {d.disposition}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-1 text-xs">Reply sent to customer</p>
          <p className="bg-muted rounded-md p-3 text-sm">{d.reply}</p>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card className="border-warn animate-in fade-in self-start border-2 duration-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound className="text-warn size-5" />
          Escalated to a human
        </CardTitle>
        <CardDescription className="font-mono text-xs">
          status escalated · {d.kind} · stage {d.stage}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm">{d.summary}</p>
        {d.draftReply && (
          <div>
            <p className="text-muted-foreground mb-1 text-xs">Draft reply for the human to approve</p>
            <p className="bg-muted rounded-md p-3 text-sm">{d.draftReply}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
