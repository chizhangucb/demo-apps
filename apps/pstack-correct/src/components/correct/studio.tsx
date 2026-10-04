"use client"

import { useState } from "react"
import { ArrowRight, Ban, CircleSlash, Layers, Play, Quote, ShieldCheck, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { LADDER, PACKS } from "@/lib/packs"
import { match, splitNotes } from "@/lib/matcher"
import type { Cluster, MatchResult, NoteHit, Snippet } from "@/lib/types"
import { cn } from "@/lib/utils"

const ONE_OFFS = [
  "rename the Save button to Submit",
  "stop using any in the cart reducer",
  "the webhook body was trusted without validation",
  "use the brand blue for links",
].join("\n")

const MIXED = [
  "please validate the request body before charging",
  "crashed on unparsed JSON from the webhook again",
  "check the API response before you use it",
  "rename the Save button to Submit",
].join("\n")

const LAYER_STYLE: Record<string, string> = {
  types: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  architecture: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  checks: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
}

export function Studio() {
  const [text, setText] = useState(PACKS[0].notes.join("\n"))
  const [activePack, setActivePack] = useState<string | null>(PACKS[0].id)
  const [result, setResult] = useState<MatchResult>(() => match(PACKS[0].notes, PACKS))
  const [tab, setTab] = useState(0)

  function run(input = text) {
    setResult(match(splitNotes(input), PACKS))
    setTab(0)
  }

  function load(value: string, packId: string | null) {
    setText(value)
    setActivePack(packId)
    run(value)
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-6 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono">/correct</Badge>
          <Badge variant="secondary">scripted · no keys · no network</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">pstack /correct playground</h1>
        <p className="max-w-3xl text-muted-foreground">
          When the same correction keeps coming back, don&apos;t write another reminder. Find the pattern and encode the
          fix in the environment: <strong>architecture</strong>, <strong>types</strong>, or <strong>checks</strong>.
        </p>
      </header>

      <StrengthLadder highlight={result.kind === "pattern" ? result.clusters[tab]?.pack.fix.mechanism : undefined} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Correction notes</CardTitle>
              <CardDescription>Pick a canned pitfall pack, or paste your own notes, one correction per line.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {PACKS.map((p) => (
                  <Button
                    key={p.id}
                    size="sm"
                    variant={activePack === p.id ? "default" : "outline"}
                    onClick={() => load(p.notes.join("\n"), p.id)}
                  >
                    {p.name}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Button size="xs" variant="ghost" onClick={() => load(MIXED, null)}>
                  Sample: paraphrased + noise
                </Button>
                <Button size="xs" variant="ghost" onClick={() => load(ONE_OFFS, null)}>
                  Sample: one-offs only
                </Button>
              </div>
              <Textarea
                aria-label="Correction notes"
                value={text}
                onChange={(e) => {
                  setText(e.target.value)
                  setActivePack(null)
                }}
                rows={9}
                className="font-mono text-xs"
                placeholder={"stop using any for the payload\nthat cast hides a missing field\n..."}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{splitNotes(text).length} notes · local keyword + overlap matcher</span>
                <Button onClick={() => run()}>
                  <Play data-icon="inline-start" /> Run /correct
                </Button>
              </div>
            </CardContent>
          </Card>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Inspired by{" "}
            <a className="underline" href="https://x.com/poteto/status/2106542593656111276" target="_blank" rel="noreferrer">
              pstack 0.15.9 <code>/correct</code>
            </a>{" "}
            (poteto). This is a scripted illustration: no pstack install, no agent session, no model. Packs live in{" "}
            <code>data/packs.json</code>.
          </p>
        </section>

        <section aria-live="polite">
          <ResultPanel result={result} tab={tab} setTab={setTab} />
        </section>
      </div>
    </main>
  )
}

function StrengthLadder({ highlight }: { highlight?: string }) {
  return (
    <div className="rounded-xl border bg-muted/40 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Layers className="size-3.5" /> Strongest mechanism wins. Prose is the symptom, not the fix.
      </div>
      <ol className="flex flex-wrap items-center gap-1.5 text-xs">
        {LADDER.map((rung, i) => (
          <li key={rung.mechanism} className="flex items-center gap-1.5">
            <span
              className={cn(
                "rounded-md border px-2 py-1",
                rung.mechanism === highlight && "border-primary bg-primary text-primary-foreground",
                rung.mechanism === "prose" && "text-muted-foreground line-through",
              )}
            >
              {rung.label} <span className="opacity-60">· {rung.layer}</span>
            </span>
            {i < LADDER.length - 1 && <span className="text-muted-foreground">&gt;</span>}
          </li>
        ))}
      </ol>
    </div>
  )
}

function ResultPanel({ result, tab, setTab }: { result: MatchResult; tab: number; setTab: (n: number) => void }) {
  if (result.kind === "empty") {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">Paste some notes and press Run.</CardContent>
      </Card>
    )
  }

  if (result.kind === "no-pattern") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleSlash className="size-4" /> No recurring pattern yet
          </CardTitle>
          <CardDescription>
            Nothing came back twice, so there is no environment fix to write. One-off notes stay one-offs; /correct waits
            for the same correction to recur.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {result.notes.map((n, i) => {
              const hit = result.oneOffs.find((h) => h.note === n)
              const pack = PACKS.find((p) => p.id === result.packIds[i])
              return (
                <li key={i} className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-xs">{n}</span>
                  <span className="text-xs text-muted-foreground">
                    {pack ? `leans ${pack.name} (1 note, needs 2)` : "no pack signal"}
                  </span>
                  {hit && <HitReasons hit={hit} />}
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    )
  }

  const cluster = result.clusters[Math.min(tab, result.clusters.length - 1)]
  return (
    <div className="space-y-4">
      {result.clusters.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {result.clusters.map((c, i) => (
            <Button key={c.pack.id} size="sm" variant={i === tab ? "default" : "outline"} onClick={() => setTab(i)}>
              {c.pack.name} · {c.hits.length}
            </Button>
          ))}
        </div>
      )}
      <ClusterView cluster={cluster} leftAlone={result.leftAlone} />
    </div>
  )
}

function ClusterView({ cluster, leftAlone }: { cluster: Cluster; leftAlone: string[] }) {
  const { pack, hits } = cluster
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="size-4" />
            <CardTitle>Pattern · {pack.name}</CardTitle>
            <Badge variant="secondary">{hits.length} notes clustered</Badge>
          </div>
          <CardDescription className="text-base text-foreground">{pack.pattern}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {hits.map((h, i) => (
            <div key={i} className="flex flex-wrap items-baseline gap-2 border-l-2 pl-3 text-sm">
              <Quote className="size-3 shrink-0 self-center text-muted-foreground" />
              <span>{h.note}</span>
              <HitReasons hit={h} />
            </div>
          ))}
          {leftAlone.length > 0 && (
            <p className="pt-2 text-xs text-muted-foreground">
              Left alone (one-off, no fix invented): {leftAlone.map((n) => `“${n}”`).join(", ")}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="ring-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Ban className="size-4" /> Wrong fix: another reminder
            </CardTitle>
            <CardDescription>What an agent usually appends to its instructions.</CardDescription>
          </CardHeader>
          <CardContent>
            <blockquote className="rounded-md bg-muted p-3 font-mono text-xs text-muted-foreground line-through decoration-destructive/60">
              {pack.wrongFix}
            </blockquote>
            <p className="mt-2 text-xs text-muted-foreground">Prose depends on being read and remembered. It is the symptom.</p>
          </CardContent>
        </Card>
        <Card className="ring-emerald-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="size-4" /> Environment fix
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", LAYER_STYLE[pack.fix.layer])}>
                layer: {pack.fix.layer}
              </span>
              <Badge variant="outline">{LADDER.find((r) => r.mechanism === pack.fix.mechanism)?.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{pack.fix.title}</p>
            <p className="text-muted-foreground">{pack.fix.summary}</p>
            <Separator />
            <p className="text-xs">
              <span className="font-medium">Why not weaker: </span>
              <span className="text-muted-foreground">{pack.fix.whyNotWeaker}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Before / after</CardTitle>
        </CardHeader>
        <CardContent className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr]">
          <Code snippet={pack.before} tone="before" />
          <ArrowRight className="hidden size-4 self-center text-muted-foreground md:block" />
          <Code snippet={pack.after} tone="after" />
        </CardContent>
      </Card>
    </div>
  )
}

function HitReasons({ hit }: { hit: NoteHit }) {
  return (
    <span className="flex flex-wrap gap-1">
      {hit.keywords.map((k) => (
        <Badge key={k} variant="outline" className="h-4 px-1.5 font-mono text-[10px]">
          {k.replace(/\*$/, "…")}
        </Badge>
      ))}
      {hit.similarTo && (
        <Badge variant="outline" className="h-4 px-1.5 text-[10px]" title={hit.similarTo}>
          ≈ canned note
        </Badge>
      )}
    </span>
  )
}

function Code({ snippet, tone }: { snippet: Snippet; tone: "before" | "after" }) {
  return (
    <figure className="min-w-0">
      <figcaption
        className={cn(
          "mb-1 text-xs font-medium",
          tone === "before" ? "text-destructive" : "text-emerald-700 dark:text-emerald-400",
        )}
      >
        {snippet.caption}
      </figcaption>
      <pre
        className={cn(
          "whitespace-pre-wrap break-words rounded-md border p-3 font-mono text-[11px] leading-relaxed",
          tone === "before" ? "border-destructive/30 bg-destructive/5" : "border-emerald-500/30 bg-emerald-500/5",
        )}
      >
        {snippet.lines.join("\n")}
      </pre>
    </figure>
  )
}
