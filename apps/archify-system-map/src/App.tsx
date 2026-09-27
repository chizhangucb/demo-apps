import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  Map as MapIcon,
  Moon,
  Sparkles,
  Sun,
  Wand2,
  XCircle,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { SEEDS, matchSeed } from '@/lib/seeds'
import { hasArrows, sketchToIR } from '@/lib/sketch'
import { validateArchitecture, type ArchitectureIR, type Diagnostic } from '@shared/archify'
import { renderArchitectureHtml } from '@shared/render'
import type { GenerateResponse, StatusResponse } from '@shared/api'

const SKETCH_EXAMPLE = `# Checkout service
Browser (React) -> API Gateway -> Checkout API: POST /orders
Checkout API -> Postgres (orders)
Checkout API -> Stripe: charge
Checkout API -> Kafka (order-events) -> Email Worker
API Gateway -> Auth (JWT): verify`

const pretty = (v: unknown) => JSON.stringify(v, null, 2)

export default function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [activeSeed, setActiveSeed] = useState<string | null>(SEEDS[0].slug)
  const [description, setDescription] = useState(SKETCH_EXAMPLE)
  const [irText, setIrText] = useState(() => pretty(SEEDS[0].ir))
  const [rendered, setRendered] = useState<ArchitectureIR>(SEEDS[0].ir as ArchitectureIR)
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [source, setSource] = useState(`Seed · ${SEEDS[0].name}`)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const frame = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    fetch('/api/status')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((s: StatusResponse) => setStatus(s))
      .catch(() => setStatus({ mode: 'samples', model: null }))
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    frame.current?.contentWindow?.postMessage({ type: 'archify:theme', theme }, '*')
  }, [theme])

  // Theme is deliberately not a dependency: toggling it is pushed into the live iframe instead.
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- theme changes are posted into the live iframe
  const html = useMemo(() => renderArchitectureHtml(rendered, { theme }), [rendered])

  /** Validates raw IR text; renders it when valid, otherwise keeps the last good map on screen. */
  const applyIr = useCallback((text: string, label?: string) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Invalid JSON')
      setDiagnostics([])
      return false
    }
    setParseError(null)
    const result = validateArchitecture(parsed)
    setDiagnostics(result.diagnostics)
    if (result.ok && result.ir) {
      setRendered(result.ir)
      if (label) setSource(label)
      return true
    }
    return false
  }, [])

  const loadIr = (ir: unknown, label: string) => {
    const text = pretty(ir)
    setIrText(text)
    applyIr(text, label)
  }

  // Light edits in the IR panel re-render as soon as they validate.
  const editTimer = useRef<number | undefined>(undefined)
  const onEdit = (text: string) => {
    setIrText(text)
    setActiveSeed(null)
    window.clearTimeout(editTimer.current)
    editTimer.current = window.setTimeout(() => applyIr(text, 'Edited IR'), 350)
  }

  const pickSeed = (slug: string) => {
    const seed = SEEDS.find((s) => s.slug === slug)!
    setActiveSeed(slug)
    setNotice(null)
    loadIr(seed.ir, `Seed · ${seed.name}`)
  }

  const renderFromPaste = () => {
    setNotice(null)
    if (hasArrows(description)) {
      const ir = sketchToIR(description)
      setActiveSeed(null)
      loadIr(ir, 'Arrow sketch · parsed offline')
      setNotice(`Parsed ${ir.components.length} components and ${ir.connections?.length ?? 0} connections from your arrow sketch.`)
      return
    }
    const seed = matchSeed(description)
    if (seed) {
      setActiveSeed(seed.slug)
      loadIr(seed.ir, `Canned match · ${seed.name}`)
      setNotice(`Matched the “${seed.name}” sample IR by keywords. ${status?.mode === 'claude' ? 'Use Generate for a bespoke map.' : 'Add an API key to generate a bespoke map.'}`)
      return
    }
    setNotice('No arrows or known keywords found. Write one edge per line (A -> B: label), or pick a seed.')
  }

  const generate = async (refine: boolean) => {
    setBusy(true)
    setNotice(null)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, current: refine ? rendered : undefined }),
      })
      const payload = (await res.json()) as GenerateResponse
      if (payload.ir) {
        setActiveSeed(null)
        const text = pretty(payload.ir)
        setIrText(text)
        const ok = applyIr(text, `Claude · ${payload.model ?? 'model'}`)
        setNotice(ok ? 'Generated IR validated and rendered.' : 'Generated IR has validation errors — fix them in the IR panel.')
      } else {
        setNotice(payload.error ?? 'Generate failed')
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Generate failed')
    } finally {
      setBusy(false)
    }
  }

  const download = () => {
    const blob = new Blob([html], { type: 'text/html' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${rendered.meta.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'system-map'}.html`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const openTab = () => {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    window.open(url, '_blank', 'noopener')
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const errors = diagnostics.filter((d) => d.severity === 'error')
  const warnings = diagnostics.filter((d) => d.severity === 'warning')
  const live = status?.mode === 'claude'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MapIcon className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">Archify System Map Studio</h1>
            <p className="text-xs text-muted-foreground">Typed JSON IR → interactive HTML architecture maps</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status && (
            <Badge variant={live ? 'default' : 'secondary'}>
              {live ? `Claude · ${status.model}` : 'Samples · offline'}
            </Badge>
          )}
          <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
        </div>
      </header>

      {status && !live && (
        <div className="px-4 pt-3 sm:px-6">
          <Alert>
            <AlertTriangle />
            <AlertTitle>Sample mode — no ANTHROPIC_API_KEY on the server</AlertTitle>
            <AlertDescription>
              Seeds, keyword matches and arrow sketches render fully offline. Set the key in <code>.env</code> to enable Generate / Refine.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <main className="grid gap-4 p-4 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle>1 · Seed stacks</CardTitle>
              <CardDescription>Checked-in sample IR under data/ — no network needed.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {SEEDS.map((s) => (
                <button
                  key={s.slug}
                  onClick={() => pickSeed(s.slug)}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors hover:border-primary/60 ${
                    activeSeed === s.slug ? 'border-primary bg-primary/10' : 'bg-card'
                  }`}
                >
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.blurb}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>2 · Describe a system</CardTitle>
              <CardDescription>
                One edge per line (<code>A -&gt; B: label</code>) parses offline; plain prose matches a seed
                {live ? ' or goes to Claude.' : '.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={7}
                className="font-mono text-xs md:text-xs"
                placeholder="Browser -> API -> Postgres"
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={renderFromPaste}>
                  <Wand2 /> Render map
                </Button>
                <Button variant="outline" disabled={!live || busy} onClick={() => generate(false)} title={live ? '' : 'Needs ANTHROPIC_API_KEY'}>
                  {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate
                </Button>
                <Button variant="ghost" disabled={!live || busy} onClick={() => generate(true)}>
                  Refine current
                </Button>
              </div>
              {notice && <p className="text-xs text-muted-foreground">{notice}</p>}
            </CardContent>
          </Card>
        </div>

        <section className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{rendered.meta.title}</div>
              <div className="text-xs text-muted-foreground">{source}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={openTab}>
                <ExternalLink /> Open
              </Button>
              <Button variant="outline" size="sm" onClick={download}>
                <Download /> HTML
              </Button>
            </div>
          </div>
          <iframe
            ref={frame}
            title="Archify map preview"
            srcDoc={html}
            sandbox="allow-scripts"
            allow="fullscreen"
            className="h-[640px] w-full rounded-xl border bg-card xl:h-[calc(100vh-190px)]"
          />
        </section>

        <Card size="sm" className="min-w-0 lg:col-span-2 2xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span>Archify IR</span>
              {parseError || errors.length ? (
                <Badge variant="destructive">
                  <XCircle /> {parseError ? 'JSON error' : `${errors.length} error${errors.length > 1 ? 's' : ''}`}
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <CheckCircle2 /> valid{warnings.length ? ` · ${warnings.length} warning${warnings.length > 1 ? 's' : ''}` : ''}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>architecture · schema_version 1 — edit to re-render live.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Textarea
              value={irText}
              onChange={(e) => onEdit(e.target.value)}
              spellCheck={false}
              className="h-[420px] resize-none font-mono text-[11px] leading-relaxed md:text-[11px] 2xl:h-[calc(100vh-330px)]"
            />
            {(parseError || diagnostics.length > 0) && (
              <ul className="max-h-32 overflow-auto rounded-md border p-2 font-mono text-[11px]">
                {parseError && <li className="text-destructive">{parseError}</li>}
                {diagnostics.map((d, i) => (
                  <li key={i} className={d.severity === 'error' ? 'text-destructive' : 'text-amber-500'}>
                    {d.path} · {d.message} <span className="opacity-60">({d.code})</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>

      <footer className="px-4 pb-6 text-xs text-muted-foreground sm:px-6">
        IR contract and visual language from{' '}
        <a className="underline" href="https://github.com/tt-a1i/archify" target="_blank" rel="noreferrer">
          tt-a1i/archify
        </a>{' '}
        (MIT). Inspired by{' '}
        <a className="underline" href="https://x.com/ungetsuli/status/2092801435398553622" target="_blank" rel="noreferrer">
          this bookmark
        </a>
        .
      </footer>
    </div>
  )
}
