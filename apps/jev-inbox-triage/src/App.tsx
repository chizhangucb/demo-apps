import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  KeyRound,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import {
  DEPARTMENTS,
  URGENCY_RUBRIC,
  type Department,
  type Provider,
  type TriagePayload,
  type TriageResult,
} from '../shared/schema'
import { SAMPLE_MESSAGES } from './samples'

const pct = (v: number) => `${Math.round(v * 100)}%`

function parseMessages(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((m) => m.trim())
    .filter(Boolean)
}

function ConfidenceBar({
  value,
  ok,
  label,
}: {
  value: number
  ok?: boolean
  label: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums font-medium text-foreground">
          {pct(value)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${
            ok === false ? 'bg-amber-500' : ok ? 'bg-emerald-500' : 'bg-foreground/70'
          }`}
          style={{ width: pct(value) }}
        />
      </div>
    </div>
  )
}

function ResultCard({
  result,
  threshold,
}: {
  result: TriageResult
  threshold: number
}) {
  const { department, urgency, humanReview } = result
  const confident = department.confidence >= threshold
  const flagged = humanReview.probability >= 0.5
  const autoRoute = confident && !flagged
  const urgencyLevel = Math.min(
    urgency.max,
    Math.max(0, Math.round(urgency.score)),
  )
  const sortedProbs = (
    Object.entries(department.probabilities) as [Department, number][]
  ).sort((a, b) => b[1] - a[1])

  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-muted-foreground leading-relaxed">
          “{result.message}”
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Department
              </span>
              <Badge variant="secondary" className="capitalize">
                {department.choice}
              </Badge>
            </div>
            <ConfidenceBar
              value={department.confidence}
              ok={confident}
              label="Choice confidence"
            />
            <div className="space-y-0.5 pt-1">
              {sortedProbs.map(([dept, p]) => (
                <div
                  key={dept}
                  className="flex justify-between text-[11px] text-muted-foreground"
                >
                  <span className="capitalize">{dept}</span>
                  <span className="tabular-nums">{pct(p)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Urgency
              </span>
              <Badge variant="outline" className="tabular-nums">
                {urgency.score.toFixed(1)} / {urgency.max}
              </Badge>
            </div>
            <ConfidenceBar
              value={urgency.score / urgency.max}
              label="Score"
            />
            <p className="text-[11px] text-muted-foreground">
              {URGENCY_RUBRIC[urgencyLevel]}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Score confidence:{' '}
              <span className="tabular-nums">{pct(urgency.confidence)}</span>
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Human review (Noul)
            </span>
            <ConfidenceBar
              value={humanReview.probability}
              ok={!flagged}
              label="P(needs human)"
            />
          </div>
        </div>

        <Separator />

        {autoRoute ? (
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-4" />
            Auto-route to <span className="capitalize">{department.choice}</span>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              Hold for human review
              <span className="block text-xs font-normal text-muted-foreground">
                {!confident &&
                  `Department confidence ${pct(department.confidence)} is below the ${pct(threshold)} gate. `}
                {flagged &&
                  `Jev flags ${pct(humanReview.probability)} probability this needs a human.`}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function App() {
  const [text, setText] = useState('')
  const [threshold, setThreshold] = useState(0.75)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<TriagePayload | null>(null)
  const [provider, setProvider] = useState<Provider | null>(null)

  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then((s: { provider: Provider }) => setProvider(s.provider))
      .catch(() => setProvider(null))
  }, [])

  const messages = useMemo(() => parseMessages(text), [text])

  async function runTriage() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      setPayload(body as TriagePayload)
    } catch (err) {
      setPayload(null)
      setError(err instanceof Error ? err.message : 'Triage failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <header className="space-y-1.5">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Inbox className="size-6" />
            Jev Inbox Triage
            {provider === 'openrouter' && (
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                live · OpenRouter
              </Badge>
            )}
            {provider === 'typesafe' && (
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                live · TypeSafe
              </Badge>
            )}
            {provider === 'sample' && (
              <Badge variant="outline" className="text-amber-600">
                sample mode
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            Paste support messages. Jev (TypeSafe System One) picks a
            department (Choice), scores urgency (Score), and flags human
            review (Noul) — each with calibrated confidence. Actions only
            fire above your confidence gate.
          </p>
        </header>

        {provider === 'sample' && (
          <Alert>
            <KeyRound />
            <AlertTitle>No API key set — showing sample heuristics</AlertTitle>
            <AlertDescription>
              For live Jev answers, put <code>OPENROUTER_API_KEY</code> (Jev
              via OpenRouter, no TypeSafe waitlist needed) or{' '}
              <code>TYPESAFE_API_KEY</code> in <code>.env</code> — or export
              it — then restart <code>bun run dev</code>. OpenRouter takes
              precedence if both are set.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Messages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste one or more support messages, separated by a blank line…"
              className="min-h-40 text-sm"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={runTriage}
                disabled={loading || messages.length === 0}
              >
                {loading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Sparkles />
                )}
                Triage {messages.length || ''} message
                {messages.length === 1 ? '' : 's'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setText(SAMPLE_MESSAGES.join('\n\n'))}
              >
                Load samples
              </Button>
              <div className="ml-auto flex min-w-52 items-center gap-3">
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  Act only if ≥{' '}
                  <span className="font-medium tabular-nums text-foreground">
                    {pct(threshold)}
                  </span>
                </span>
                <Slider
                  value={[threshold]}
                  min={0.5}
                  max={0.99}
                  step={0.01}
                  onValueChange={([v]) => setThreshold(v)}
                  className="flex-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Triage failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {payload && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">
                {payload.results.length} result
                {payload.results.length === 1 ? '' : 's'} · model{' '}
                <code>{payload.model}</code>
              </h2>
              {payload.provider === 'sample' ? (
                <Badge variant="outline" className="text-amber-600">
                  sample data
                </Badge>
              ) : (
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                  live via{' '}
                  {payload.provider === 'openrouter' ? 'OpenRouter' : 'TypeSafe'}
                </Badge>
              )}
            </div>
            {payload.results.map((result, i) => (
              <ResultCard key={i} result={result} threshold={threshold} />
            ))}
          </section>
        )}

        <footer className="pt-4 text-center text-xs text-muted-foreground">
          Departments: {Object.keys(DEPARTMENTS).join(' · ')} — single-user
          demo, no data stored.
        </footer>
      </main>
    </div>
  )
}
