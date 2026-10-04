import 'server-only'
import { APIError, TypeSafeClient, choice, noul, score } from '@typesafe-ai/sdk'
import { QUESTIONS } from '@/lib/policy'
import type { DoneAnswer, GateRequest, ModelPickAnswer, ModelTier, Provider, StatusResponse, ToolGateAnswer } from '@/lib/types'

// Jev is reachable directly via TypeSafe or via OpenRouter (same API shape),
// so one SDK serves both — only apiKey/baseURL differ.
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api'

function provider(): Provider | null {
  if (process.env.OPENROUTER_API_KEY?.trim()) return 'openrouter'
  if (process.env.TYPESAFE_API_KEY?.trim()) return 'typesafe'
  return null
}

export function getStatus(): StatusResponse {
  const p = provider()
  return { live: Boolean(p), provider: p }
}

function client(): TypeSafeClient {
  const p = provider()
  if (p === 'openrouter') return new TypeSafeClient({ apiKey: process.env.OPENROUTER_API_KEY!.trim(), baseURL: OPENROUTER_BASE_URL })
  if (p === 'typesafe') return new TypeSafeClient({ apiKey: process.env.TYPESAFE_API_KEY!.trim() })
  throw new Error('Live mode needs OPENROUTER_API_KEY or TYPESAFE_API_KEY on the server.')
}

const MODEL_QUESTIONS = {
  tier: choice(QUESTIONS.model.tier, QUESTIONS.model.tiers),
  complexity: score(QUESTIONS.model.complexity, QUESTIONS.model.complexityRubric),
}
const TOOL_QUESTIONS = { unsafe: noul(QUESTIONS.tool.unsafe, QUESTIONS.tool.criteria) }
const DONE_QUESTIONS = { done: score(QUESTIONS.done.score, QUESTIONS.done.rubric) }

export async function askGate(req: GateRequest): Promise<ModelPickAnswer | ToolGateAnswer | DoneAnswer> {
  const task = req.task.trim().slice(0, 2000)
  if (!task) throw new Error('Task is empty.')
  try {
    if (req.gate === 'model') {
      const { answers } = await client().systemOne({ state: { task }, questions: MODEL_QUESTIONS })
      return {
        choice: answers.tier.choice as ModelTier,
        confidence: answers.tier.confidence,
        probabilities: answers.tier.probabilities as Record<ModelTier, number>,
        complexity: answers.complexity.score,
      }
    }
    if (req.gate === 'tool') {
      const { answers } = await client().systemOne({
        state: { task, tool: req.call.tool.slice(0, 100), args: req.call.args.slice(0, 500) },
        questions: TOOL_QUESTIONS,
      })
      return { noul: answers.unsafe.noul }
    }
    const { answers } = await client().systemOne({
      state: { task, tool_results: req.evidence.slice(0, 10).map((e) => e.slice(0, 500)), answer: req.answer.slice(0, 2000) },
      questions: DONE_QUESTIONS,
    })
    return { score: answers.done.score, confidence: answers.done.confidence }
  } catch (err) {
    if (err instanceof APIError) throw new Error(`Jev API error (HTTP ${err.status}): ${err.message}`)
    throw err
  }
}
