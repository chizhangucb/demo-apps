// Shapes shared by the /api routes and the studio UI.

export type GraphNodeId = 'search' | 'judge' | 'investigate' | 'resolve' | 'escalate'
export type Branch = 'resolve' | 'investigate' | 'escalate'
export type Source = 'scripted' | 'heuristic' | 'jev' | 'claude'

export interface KbHit {
  id: string
  title: string
  snippet: string
  score: number
}

export interface ToolCall {
  tool: string
  args: string
  result: string
}

export type TraceEntry =
  | { node: 'search'; source: Source; tool: string; query: string; hits: KbHit[] }
  | {
      node: 'judge'
      source: Source
      model: string | null
      question: string
      probabilities: Record<Branch, number>
      choice: Branch
      confidence: number
      taken: Branch
      unsure: boolean
      unsureGate: number
    }
  | {
      node: 'investigate'
      source: Source
      model: string | null
      toolCalls: ToolCall[]
      summary: string
      findings: string[]
      needsHuman: boolean
    }
  | { node: 'gate'; label: string; predicate: string; fired: boolean }
  | { node: 'resolve'; label: string; disposition: string; reply: string }
  | { node: 'escalate'; label: string; kind: string; stage: string; summary: string }

export type Disposition =
  | { status: 'resolved'; disposition: 'auto_resolved' | 'resolved_after_investigation'; reply: string }
  | { status: 'escalated'; kind: string; stage: string; summary: string; label: string; draftReply?: string }

export interface RunResponse {
  ok: true
  mode: 'scripted' | 'live'
  ticket: string
  trace: TraceEntry[]
  events: { type: string; label: string; detail?: unknown }[]
  disposition: Disposition
  durationMs: number
  workflowSha256: string
}

export interface RunError {
  ok: false
  error: string
}

export interface StatusResponse {
  jev: 'typesafe' | 'openrouter' | null
  anthropic: boolean
  agentModel: string | null
  live: boolean
}

export interface SeedTicket {
  id: string
  title: string
  path: string
  customer: string
  ticket: string
}
