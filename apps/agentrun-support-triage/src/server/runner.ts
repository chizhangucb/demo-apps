// Server-side host for the support-triage workflow. The real AgentRun
// interpreter (@parcha/agentrun-dsl) runs the control flow; this file only
// supplies the host adapters it asks for:
//   runEffect → the `kb.search` tool (local KB, never the network)
//   runJudge  → scripted fixture/heuristic, or live Jev via @parcha/agentrun-jev
//   runNode   → scripted investigation, or a live Claude agent via Anthropic
import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { runWorkflow, workflowSha256, type Workflow, type WorkflowDeps } from '@parcha/agentrun-dsl'
import { createJevRunner } from '@parcha/agentrun-jev'
import kbData from '../../data/kb.json'
import ticketData from '../../data/tickets.json'
import { ROUTE_QUESTION, UNSURE_GATE, supportTriageWorkflow } from '@/lib/workflow'
import type {
  Branch,
  Disposition,
  KbHit,
  RunResponse,
  SeedTicket,
  Source,
  StatusResponse,
  ToolCall,
  TraceEntry,
} from '@/lib/types'

interface KbArticle {
  id: string
  title: string
  snippet: string
  keywords: string[]
}

interface TicketFixture extends SeedTicket {
  script: {
    hits: { id: string; score: number }[]
    judge: { probabilities: Record<Branch, number>; confidence: number }
    investigation?: {
      tool_calls: ToolCall[]
      summary: string
      findings: string[]
      needs_human: boolean
      reply: string
    }
  }
}

const KB = kbData as KbArticle[]
const TICKETS = ticketData as TicketFixture[]
const WORKFLOW = supportTriageWorkflow as unknown as Workflow
const BRANCHES: Branch[] = ['resolve', 'investigate', 'escalate']
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api'
const AGENT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'

export function seedTickets(): SeedTicket[] {
  return TICKETS.map(({ id, title, path, customer, ticket }) => ({ id, title, path, customer, ticket }))
}

function jevProvider(): StatusResponse['jev'] {
  if (process.env.OPENROUTER_API_KEY?.trim()) return 'openrouter'
  if (process.env.TYPESAFE_API_KEY?.trim()) return 'typesafe'
  return null
}

export function getStatus(): StatusResponse {
  const jev = jevProvider()
  const anthropic = Boolean(process.env.ANTHROPIC_API_KEY?.trim())
  return { jev, anthropic, agentModel: anthropic ? AGENT_MODEL : null, live: Boolean(jev || anthropic) }
}

// --- kb.search tool ---------------------------------------------------------

function searchKb(query: string): KbHit[] {
  const text = query.toLowerCase()
  return KB.map((a) => {
    const matched = a.keywords.filter((k) => text.includes(k)).length
    return { id: a.id, title: a.title, snippet: a.snippet, score: Math.min(0.95, matched / 3) }
  })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((h) => ({ ...h, score: Math.round(h.score * 100) / 100 }))
}

function fixtureHits(fixture: TicketFixture): KbHit[] {
  return fixture.script.hits.map(({ id, score }) => {
    const a = KB.find((k) => k.id === id)!
    return { id, title: a.title, snippet: a.snippet, score }
  })
}

// --- scripted judgments -----------------------------------------------------

const ESCALATE_WORDS = ['lawyer', 'legal', 'gdpr', 'ccpa', 'hacked', 'fraud', 'breach', 'sue', 'unacceptable', 'cancel my', 'chargeback', 'personal data']
const INVESTIGATE_WORDS = ['charged', 'twice', 'refund', 'error', '500', 'failing', 'failed', 'missing', 'not working', 'down', 'broken', 'slow', 'invoice']

function heuristicJudge(ticket: string, hits: KbHit[]): { probabilities: Record<Branch, number>; confidence: number } {
  const text = ticket.toLowerCase()
  const esc = ESCALATE_WORDS.filter((w) => text.includes(w)).length
  const inv = INVESTIGATE_WORDS.filter((w) => text.includes(w)).length
  const top = hits[0]?.score ?? 0
  const raw: Record<Branch, number> = {
    resolve: 0.2 + (inv === 0 && esc === 0 ? top * 3 : top * 0.5),
    investigate: 0.2 + inv * 0.9,
    escalate: 0.2 + esc * 1.6,
  }
  const sum = raw.resolve + raw.investigate + raw.escalate
  const probabilities = {
    resolve: raw.resolve / sum,
    investigate: raw.investigate / sum,
    escalate: 0,
  }
  probabilities.escalate = 1 - probabilities.resolve - probabilities.investigate
  const sorted = Object.values(probabilities).sort((a, b) => b - a)
  const confidence = Math.max(0.05, Math.min(0.95, (sorted[0] - sorted[1]) * 1.6))
  return { probabilities, confidence: Math.round(confidence * 100) / 100 }
}

function argmax(p: Record<Branch, number>): Branch {
  return BRANCHES.reduce((best, b) => (p[b] > p[best] ? b : best), 'resolve' as Branch)
}

// --- scripted investigation -------------------------------------------------

const HUMAN_WORDS = ['several', 'everyone', 'all users', 'teammates', 'outage', 'data loss', 'audit', 'security', 'urgent', 'down']

function heuristicInvestigation(ticket: string, hits: KbHit[]) {
  const text = ticket.toLowerCase()
  const needsHuman = HUMAN_WORDS.some((w) => text.includes(w))
  const tool_calls: ToolCall[] = [
    { tool: 'account.lookup', args: 'from ticket sender', result: 'Demo workspace · Pro plan · no open incidents on account' },
    { tool: 'logs.search', args: 'last 24h', result: needsHuman ? 'Error spike correlated with the reported symptom (multiple users)' : 'No errors for this account in the last 24h' },
  ]
  return {
    tool_calls,
    summary: needsHuman
      ? 'Errors affect more than one user — this looks like a platform issue support cannot fix alone.'
      : `Account looks healthy; the closest guidance is “${hits[0]?.title ?? 'general help center'}”.`,
    findings: needsHuman ? ['Multiple users affected', 'No incident declared'] : ['No account errors', 'KB guidance applies'],
    needs_human: needsHuman,
    reply: needsHuman
      ? "Thanks for the report — we can see errors on our side and have escalated to engineering. We'll follow up with an update shortly."
      : `Thanks for reaching out! We checked your account and everything looks healthy. ${hits[0]?.snippet ?? ''}`.trim(),
  }
}

// --- live adapters ----------------------------------------------------------

function liveJudge(): NonNullable<WorkflowDeps['runJudge']> | null {
  const provider = jevProvider()
  if (provider === 'openrouter') {
    return createJevRunner({ apiKey: process.env.OPENROUTER_API_KEY!.trim(), baseURL: OPENROUTER_BASE_URL, timeoutMs: 30_000 })
  }
  if (provider === 'typesafe') return createJevRunner({ timeoutMs: 30_000 })
  return null
}

function anthropicClient(): Anthropic {
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim()
  return new Anthropic(workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : undefined)
}

async function liveInvestigate(
  params: Parameters<NonNullable<WorkflowDeps['runNode']>>[0],
  evidence: ToolCall[],
): Promise<{ output: unknown; model: string }> {
  const evidenceText = evidence.map((c) => `- ${c.tool}(${c.args}) → ${c.result}`).join('\n')
  const response = await anthropicClient().messages.create({
    model: AGENT_MODEL,
    max_tokens: 2000,
    system: params.system.join('\n\n'),
    tools: [{ name: 'submit', description: 'Submit the investigation result.', input_schema: params.schema as Anthropic.Tool.InputSchema }],
    tool_choice: { type: 'tool', name: 'submit' },
    messages: [
      {
        role: 'user',
        content: `${params.user}\n\nThe host already ran these tools for you (demo data):\n${evidenceText}\n\nSubmit your investigation with the submit tool.`,
      },
    ],
  })
  const use = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
  if (!use) throw new Error('The investigate agent did not submit a result.')
  return { output: use.input, model: response.model }
}

// --- run ----------------------------------------------------------------------

export async function runTriage({ ticketId, ticket, live }: { ticketId?: string; ticket: string; live: boolean }): Promise<RunResponse> {
  const text = ticket.trim().slice(0, 2000)
  if (!text) throw new Error('Paste a ticket or pick a seeded one first.')
  const fixture = TICKETS.find((t) => t.id === ticketId && t.ticket === text)
  const status = getStatus()
  const useLive = live && status.live
  const jev = useLive ? liveJudge() : null
  const claude = useLive && status.anthropic

  const trace: TraceEntry[] = []
  const events: RunResponse['events'] = []
  let hits: KbHit[] = []
  let judgeSource: Source = fixture ? 'scripted' : 'heuristic'
  let judgeModel: string | null = null
  let investigation: TicketFixture['script']['investigation'] | undefined

  const deps: WorkflowDeps = {
    runEffect: async ({ node, input }) => {
      const query = String((input as { query?: unknown }).query ?? text)
      hits = fixture ? fixtureHits(fixture) : searchKb(query)
      trace.push({ node: 'search', source: fixture ? 'scripted' : 'heuristic', tool: node.tool ?? 'kb.search', query, hits })
      return { hits }
    },
    runJudge: async (params) => {
      if (jev) {
        judgeSource = 'jev'
        const res = await jev(params)
        judgeModel = res.model ?? null
        return res
      }
      const { probabilities, confidence } = fixture ? fixture.script.judge : heuristicJudge(text, hits)
      judgeModel = fixture ? 'scripted-fixture' : 'keyword-heuristic'
      return {
        model: judgeModel,
        cost_usd: 0,
        answers: { branch: { type: 'choice', choice: argmax(probabilities), probabilities: { ...probabilities }, confidence } },
      }
    },
    runNode: async (params) => {
      const scripted = fixture?.script.investigation ?? heuristicInvestigation(text, hits)
      let source: Source = fixture ? 'scripted' : 'heuristic'
      let model: string | null = null
      let output: unknown = scripted
      if (claude) {
        const res = await liveInvestigate(params, scripted.tool_calls)
        source = 'claude'
        model = res.model
        output = res.output
      }
      const o = output as { summary: string; findings: string[]; needs_human: boolean; reply: string }
      investigation = { ...o, tool_calls: scripted.tool_calls }
      trace.push({
        node: 'investigate',
        source,
        model,
        toolCalls: scripted.tool_calls,
        summary: o.summary,
        findings: o.findings,
        needsHuman: o.needs_human,
      })
      const { summary, findings, needs_human, reply } = o
      return { summary, findings, needs_human, reply }
    },
    onEvent: (event) => {
      const { type, label, detail } = event
      events.push({ type, label, detail })
      const d = (detail ?? {}) as Record<string, unknown>
      if (type === 'route.chosen') {
        const value = d.value as { branch: Branch; taken: Branch; unsure: boolean }
        const answer = (d.sidecar as { answers: { branch: { probabilities: Record<Branch, number>; confidence: number } } })
          .answers.branch
        trace.push({
          node: 'judge',
          source: judgeSource,
          model: judgeModel,
          question: ROUTE_QUESTION,
          probabilities: answer.probabilities,
          choice: value.branch,
          confidence: answer.confidence,
          taken: value.taken,
          unsure: value.unsure,
          unsureGate: UNSURE_GATE,
        })
      } else if (type === 'escalate.evaluated' && label === 'escalate-after-investigation') {
        trace.push({ node: 'gate', label, predicate: 'field_true investigation.needs_human', fired: Boolean(d.fired) })
      } else if (type === 'code.patch') {
        const outcome = (d as { outcome?: { disposition: string; reply: string } }).outcome
        if (outcome) trace.push({ node: 'resolve', label, disposition: outcome.disposition, reply: outcome.reply })
      }
    },
  }

  const started = Date.now()
  const result = await runWorkflow(WORKFLOW, { ticket: text }, deps)
  let disposition: Disposition
  if (result.status === 'escalated') {
    const { kind, stage, summary, label = '' } = result.escalation
    const routing = result.state.routing as { unsure?: boolean } | undefined
    const detail = investigation
      ? `${summary} ${investigation.summary}`
      : routing?.unsure
        ? `Jev was below the ${UNSURE_GATE} confidence gate, so the route fell back to a human.`
        : 'Jev chose the escalate branch: legal, privacy, security or churn risk that support must not action alone.'
    trace.push({ node: 'escalate', label, kind, stage, summary: detail })
    disposition = { status: 'escalated', kind, stage, summary: detail, label, draftReply: investigation?.reply }
  } else {
    const out = result.output as { disposition: 'auto_resolved' | 'resolved_after_investigation'; reply: string }
    disposition = { status: 'resolved', disposition: out.disposition, reply: out.reply }
  }

  return {
    ok: true,
    mode: useLive ? 'live' : 'scripted',
    ticket: text,
    trace,
    events,
    disposition,
    durationMs: Date.now() - started,
    workflowSha256: workflowSha256(WORKFLOW),
  }
}
