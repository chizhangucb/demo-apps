import {
  APIError,
  choice,
  noul,
  score,
  TypeSafeClient,
  TypeSafeError,
} from '@typesafe-ai/sdk'
import {
  DEPARTMENTS,
  URGENCY_RUBRIC,
  type Department,
  type Provider,
  type TriagePayload,
  type TriageResult,
} from '../shared/schema.ts'

// Jev is reachable two ways: directly via TypeSafe (waitlisted API key) or via
// OpenRouter, which proxies System One at the same API shape — so the official
// SDK works for both, only apiKey/baseURL differ.
// https://openrouter.ai/docs/guides/community/typesafe-sdk
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api'

interface ResolvedProvider {
  provider: Provider
  makeClient?: () => TypeSafeClient
  label: string
}

/** Key precedence: OPENROUTER_API_KEY → TYPESAFE_API_KEY → sample heuristics. */
function resolveProvider(): ResolvedProvider {
  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim()
  if (openrouterKey) {
    return {
      provider: 'openrouter',
      label: 'OpenRouter',
      makeClient: () =>
        new TypeSafeClient({
          apiKey: openrouterKey,
          baseURL: OPENROUTER_BASE_URL,
        }),
    }
  }
  const typesafeKey = process.env.TYPESAFE_API_KEY?.trim()
  if (typesafeKey) {
    return {
      provider: 'typesafe',
      label: 'TypeSafe',
      makeClient: () => new TypeSafeClient(),
    }
  }
  return { provider: 'sample', label: 'sample heuristics' }
}

export function getStatus(): { provider: Provider } {
  return { provider: resolveProvider().provider }
}

const QUESTIONS = {
  department: choice(
    'Which support department should handle this message?',
    DEPARTMENTS,
  ),
  urgency: score('How urgent is this support message?', URGENCY_RUBRIC),
  humanReview: noul(
    'Should a human review this message before any automated action is taken?',
    {
      true: 'Ambiguous, emotionally charged, legally sensitive, or high-stakes',
      false: 'Routine and safe to route automatically',
    },
  ),
}

export async function triageMessages(
  messages: string[],
): Promise<TriagePayload> {
  const trimmed = messages.map((m) => m.trim()).filter(Boolean)
  if (trimmed.length === 0) throw new Error('No messages to triage')
  const { provider, label, makeClient } = resolveProvider()
  if (!makeClient) {
    return {
      provider: 'sample',
      model: 'sample-heuristics',
      results: trimmed.map(sampleTriage),
    }
  }

  const client = makeClient()
  let model = client.defaultModel
  const results = await Promise.all(
    trimmed.map(async (message) => {
      try {
        const response = await client.systemOne({
          state: message,
          questions: QUESTIONS,
        })
        model = response.model
        const { department, urgency, humanReview } = response.answers
        return {
          message,
          department: {
            choice: department.choice,
            confidence: department.confidence,
            probabilities: department.probabilities,
          },
          urgency: {
            score: urgency.score,
            confidence: urgency.confidence,
            max: URGENCY_RUBRIC.length - 1,
          },
          humanReview: { probability: humanReview.noul },
        } satisfies TriageResult
      } catch (err) {
        if (err instanceof APIError) {
          throw new Error(`${label} API error (HTTP ${err.status}): ${err.message}`)
        }
        if (err instanceof TypeSafeError) {
          throw new Error(`${label} client error: ${err.message}`)
        }
        throw err
      }
    }),
  )
  return { provider, model, results }
}

// --- Sample mode -----------------------------------------------------------
// Deterministic keyword heuristics used only when neither OPENROUTER_API_KEY
// nor TYPESAFE_API_KEY is set, so the UI stays demoable without a key.

const KEYWORDS: Record<Department, string[]> = {
  billing: ['charge', 'charged', 'invoice', 'refund', 'payment', 'card', 'subscription', 'billed', 'price'],
  technical: ['error', 'bug', 'crash', 'broken', '500', 'down', 'fails', 'failing', 'load', 'export'],
  account: ['login', 'log in', 'password', 'account', 'locked', '2fa', 'email address', 'delete my'],
  orders: ['order', 'shipping', 'delivery', 'tracking', 'package', 'return', 'arrived'],
  other: [],
}

const URGENT_WORDS = ['urgent', 'asap', 'immediately', 'right now', 'critical', 'outage', 'down', 'locked', 'losing', 'security', 'hacked', 'twice']
const SENSITIVE_WORDS = ['angry', 'lawyer', 'legal', 'gdpr', 'delete my', 'refund', 'cancel', 'unacceptable', 'hacked', 'fraud']

function countHits(text: string, words: string[]) {
  return words.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0)
}

function sampleTriage(message: string): TriageResult {
  const text = message.toLowerCase()
  const weights = Object.fromEntries(
    (Object.keys(DEPARTMENTS) as Department[]).map((dept) => [
      dept,
      Math.exp(1.2 * Math.min(3, countHits(text, KEYWORDS[dept]))) +
        (dept === 'other' ? 0.7 : 0.3),
    ]),
  ) as Record<Department, number>
  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  const probabilities = Object.fromEntries(
    Object.entries(weights).map(([dept, w]) => [dept, w / total]),
  ) as Record<Department, number>
  const best = (Object.entries(probabilities) as [Department, number][]).sort(
    (a, b) => b[1] - a[1],
  )[0]

  const urgentHits = countHits(text, URGENT_WORDS)
  const rawScore = Math.min(3, 0.8 + urgentHits * 0.9 + (text.includes('!') ? 0.3 : 0))
  const sensitiveHits = countHits(text, SENSITIVE_WORDS)
  const humanReview = Math.min(
    0.97,
    0.12 + sensitiveHits * 0.28 + (best[1] < 0.5 ? 0.25 : 0),
  )

  return {
    message,
    department: { choice: best[0], confidence: best[1], probabilities },
    urgency: {
      score: Math.round(rawScore * 10) / 10,
      confidence: Math.min(0.92, 0.55 + urgentHits * 0.12),
      max: URGENCY_RUBRIC.length - 1,
    },
    humanReview: { probability: Math.round(humanReview * 100) / 100 },
  }
}
