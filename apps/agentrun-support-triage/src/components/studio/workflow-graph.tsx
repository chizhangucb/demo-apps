'use client'

import type { Branch, GraphNodeId, TraceEntry } from '@/lib/types'

export type NodeState = 'idle' | 'active' | 'done' | 'skipped'

const NODES: Record<GraphNodeId, { x: number; y: number; title: string; kind: string }> = {
  search: { x: 10, y: 95, title: 'Tool search', kind: 'call · kb.search' },
  judge: { x: 200, y: 95, title: 'Jev judge', kind: 'route · 3 branches' },
  investigate: { x: 430, y: 95, title: 'Investigate', kind: 'agent · gate' },
  resolve: { x: 630, y: 20, title: 'Resolve', kind: 'code · reply' },
  escalate: { x: 630, y: 170, title: 'Escalate', kind: 'escalate · human' },
}
const W = 160
const H = 58

const EDGES: { from: GraphNodeId; to: GraphNodeId; branch?: Branch }[] = [
  { from: 'search', to: 'judge' },
  { from: 'judge', to: 'resolve', branch: 'resolve' },
  { from: 'judge', to: 'investigate', branch: 'investigate' },
  { from: 'judge', to: 'escalate', branch: 'escalate' },
  { from: 'investigate', to: 'resolve' },
  { from: 'investigate', to: 'escalate' },
]

export function graphNodeOf(entry: TraceEntry): GraphNodeId {
  return entry.node === 'gate' ? 'investigate' : entry.node
}

function edgePath(from: GraphNodeId, to: GraphNodeId) {
  const a = NODES[from]
  const b = NODES[to]
  const x1 = a.x + W
  const y1 = a.y + H / 2
  const x2 = b.x
  const y2 = b.y + H / 2
  // judge → resolve/escalate jump over the investigate node
  if (from === 'judge' && to !== 'investigate') {
    const cx = a.x + W / 2
    const startY = to === 'resolve' ? a.y : a.y + H
    return `M ${cx} ${startY} C ${cx} ${y2}, ${cx} ${y2}, ${x2} ${y2}`
  }
  const cx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`
}

const STATE_STYLE: Record<NodeState, { fill: string; stroke: string; text: string; dash?: string }> = {
  idle: { fill: 'var(--card)', stroke: 'var(--border)', text: 'var(--foreground)' },
  active: { fill: 'color-mix(in oklch, var(--flow) 16%, var(--card))', stroke: 'var(--flow)', text: 'var(--foreground)' },
  done: { fill: 'var(--card)', stroke: 'var(--foreground)', text: 'var(--foreground)' },
  skipped: { fill: 'var(--muted)', stroke: 'var(--border)', text: 'var(--muted-foreground)', dash: '4 4' },
}

export function WorkflowGraph({
  states,
  path,
  judge,
}: {
  states: Record<GraphNodeId, NodeState>
  path: GraphNodeId[]
  judge?: Extract<TraceEntry, { node: 'judge' }>
}) {
  const taken = new Set(path.slice(1).map((to, i) => `${path[i]}>${to}`))
  return (
    <svg viewBox="0 0 800 240" className="h-auto w-full" role="img" aria-label="Support-triage workflow graph">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--muted-foreground)" />
        </marker>
        <marker id="arrow-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--flow)" />
        </marker>
      </defs>
      {EDGES.map((e) => {
        const on = taken.has(`${e.from}>${e.to}`)
        const p = e.branch && judge ? judge.probabilities[e.branch] : undefined
        const d = edgePath(e.from, e.to)
        return (
          <g key={`${e.from}-${e.to}`}>
            <path
              d={d}
              fill="none"
              stroke={on ? 'var(--flow)' : 'var(--border)'}
              strokeWidth={on ? 2.5 : 1.5}
              markerEnd={on ? 'url(#arrow-on)' : 'url(#arrow)'}
              className="transition-all duration-500"
            />
            {p !== undefined && (
              <text
                x={e.to === 'investigate' ? 395 : 420}
                y={e.to === 'investigate' ? 84 : e.to === 'resolve' ? 42 : 212}
                textAnchor="middle"
                fontSize="11"
                className="font-mono"
                fill={on ? 'var(--flow)' : 'var(--muted-foreground)'}
              >
                {e.branch} {p.toFixed(2)}
              </text>
            )}
          </g>
        )
      })}
      {(Object.keys(NODES) as GraphNodeId[]).map((id) => {
        const n = NODES[id]
        const s = STATE_STYLE[states[id]]
        const stroke =
          states[id] === 'done' && id === 'resolve'
            ? 'var(--ok)'
            : states[id] === 'done' && id === 'escalate'
              ? 'var(--warn)'
              : s.stroke
        return (
          <g key={id} className={states[id] === 'active' ? 'animate-pulse' : undefined}>
            <rect
              x={n.x}
              y={n.y}
              width={W}
              height={H}
              rx="10"
              fill={s.fill}
              stroke={stroke}
              strokeWidth={states[id] === 'idle' || states[id] === 'skipped' ? 1.5 : 2.5}
              strokeDasharray={s.dash}
              className="transition-all duration-500"
            />
            <text x={n.x + 14} y={n.y + 24} fontSize="14" fontWeight="600" fill={s.text}>
              {n.title}
            </text>
            <text x={n.x + 14} y={n.y + 43} fontSize="11" fill="var(--muted-foreground)" className="font-mono">
              {n.kind}
            </text>
            {states[id] !== 'idle' && (
              <circle
                cx={n.x + W - 14}
                cy={n.y + 14}
                r="4"
                fill={states[id] === 'skipped' ? 'none' : stroke}
                stroke={stroke}
                strokeWidth="1.5"
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}
