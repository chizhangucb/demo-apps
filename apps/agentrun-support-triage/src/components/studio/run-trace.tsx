'use client'

import { Badge } from '@/components/ui/badge'
import type { Source, TraceEntry } from '@/lib/types'

const SOURCE_LABEL: Record<Source, string> = {
  scripted: 'scripted fixture',
  heuristic: 'offline heuristic',
  jev: 'live Jev',
  claude: 'live Claude',
}

function SourceBadge({ source, model }: { source: Source; model?: string | null }) {
  const live = source === 'jev' || source === 'claude'
  return (
    <Badge variant={live ? 'default' : 'secondary'} className="font-mono text-[10px]">
      {SOURCE_LABEL[source]}
      {live && model ? ` · ${model}` : ''}
    </Badge>
  )
}

function Step({ index, title, children, badge }: { index: number; title: string; children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <li className="animate-in fade-in slide-in-from-bottom-1 relative border-l pb-4 pl-5 duration-300 last:pb-0">
      <span className="bg-background text-muted-foreground absolute top-0 -left-[11px] flex size-[22px] items-center justify-center rounded-full border font-mono text-[10px]">
        {index + 1}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{title}</span>
        {badge}
      </div>
      <div className="text-muted-foreground mt-1.5 space-y-1.5 text-xs">{children}</div>
    </li>
  )
}

function Bar({ label, value, on }: { label: string; value: number; on: boolean }) {
  return (
    <div className="flex items-center gap-2 font-mono">
      <span className={`w-20 ${on ? 'text-foreground font-semibold' : ''}`}>{label}</span>
      <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded">
        <div className={`h-full rounded ${on ? 'bg-flow' : 'bg-muted-foreground/40'}`} style={{ width: `${value * 100}%` }} />
      </div>
      <span className="w-10 text-right">{value.toFixed(2)}</span>
    </div>
  )
}

export function RunTrace({ entries }: { entries: TraceEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">Pick a ticket and press Run workflow — each interpreter step lands here in order.</p>
  }
  return (
    <ol className="ml-2.5">
      {entries.map((e, i) => {
        switch (e.node) {
          case 'search':
            return (
              <Step key={i} index={i} title={`tool-search → ${e.tool}`} badge={<SourceBadge source={e.source} />}>
                <p>
                  query: <span className="text-foreground">“{e.query.length > 90 ? `${e.query.slice(0, 90)}…` : e.query}”</span>
                </p>
                {e.hits.length === 0 && <p>No knowledge-base hits.</p>}
                {e.hits.map((h) => (
                  <p key={h.id} className="font-mono">
                    {h.score.toFixed(2)} · <span className="text-foreground">{h.title}</span>
                  </p>
                ))}
              </Step>
            )
          case 'judge':
            return (
              <Step key={i} index={i} title="jev-judge → route" badge={<SourceBadge source={e.source} model={e.model} />}>
                <p>{e.question}</p>
                <div className="space-y-1 pt-1">
                  {(['resolve', 'investigate', 'escalate'] as const).map((b) => (
                    <Bar key={b} label={b} value={e.probabilities[b] ?? 0} on={b === e.taken} />
                  ))}
                </div>
                <p>
                  choice <span className="text-foreground font-mono">{e.choice}</span> · confidence{' '}
                  <span className="text-foreground font-mono">{e.confidence.toFixed(2)}</span> · gate {e.unsureGate} →{' '}
                  {e.unsure ? (
                    <span className="text-warn font-medium">below gate, fell back to escalate</span>
                  ) : (
                    <span className="text-foreground">branch taken: {e.taken}</span>
                  )}
                </p>
              </Step>
            )
          case 'investigate':
            return (
              <Step key={i} index={i} title="investigate → agent" badge={<SourceBadge source={e.source} model={e.model} />}>
                {e.toolCalls.map((c) => (
                  <p key={c.tool} className="font-mono">
                    <span className="text-foreground">{c.tool}</span>({c.args}) → {c.result}
                  </p>
                ))}
                <p className="text-foreground">{e.summary}</p>
                <ul className="list-disc pl-4">
                  {e.findings.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <p>
                  needs_human: <span className="text-foreground font-mono">{String(e.needsHuman)}</span>
                </p>
              </Step>
            )
          case 'gate':
            return (
              <Step key={i} index={i} title={`${e.label} → escalate gate`}>
                <p className="font-mono">
                  when {e.predicate} → {e.fired ? 'fired' : 'passed'}
                </p>
              </Step>
            )
          case 'resolve':
            return (
              <Step key={i} index={i} title={`${e.label} → code`}>
                <p className="font-mono">outcome.disposition = {e.disposition}</p>
              </Step>
            )
          case 'escalate':
            return (
              <Step key={i} index={i} title={`${e.label} → escalate`}>
                <p className="font-mono">
                  kind {e.kind} · stage {e.stage}
                </p>
                <p>{e.summary}</p>
              </Step>
            )
        }
      })}
    </ol>
  )
}
