export const DEPARTMENTS = {
  billing: 'Payments, charges, invoices, subscriptions, refunds',
  technical: 'Bugs, errors, crashes, outages, product not working',
  account: 'Login, password, profile changes, security, data requests',
  orders: 'Order status, shipping, delivery, returns, tracking',
  other: 'Anything that fits none of the other departments',
} as const

export const URGENCY_RUBRIC = [
  'Can wait — no time pressure, informational',
  'Normal — answer in the regular queue',
  'High — the user is blocked or losing money',
  'Critical — outage, security incident, or imminent harm',
] as const

export type Department = keyof typeof DEPARTMENTS

export interface TriageResult {
  message: string
  department: {
    choice: Department
    confidence: number
    probabilities: Record<Department, number>
  }
  urgency: { score: number; confidence: number; max: number }
  humanReview: { probability: number }
}

/**
 * Where answers come from, in precedence order:
 * OpenRouter key → TypeSafe key → local sample heuristics.
 */
export type Provider = 'openrouter' | 'typesafe' | 'sample'

export interface TriagePayload {
  provider: Provider
  model: string
  results: TriageResult[]
}
