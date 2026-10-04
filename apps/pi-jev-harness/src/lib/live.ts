// Live path: the same three questions, answered by real Jev through /api/gate.
import type { Decider, DoneAnswer, GateRequest, ModelPickAnswer, ToolGateAnswer } from './types'

async function ask<T>(body: GateRequest): Promise<T> {
  const res = await fetch('/api/gate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = (await res.json()) as T & { error?: string }
  if (!res.ok) throw new Error(data.error ?? `Jev gate failed (HTTP ${res.status})`)
  return data
}

export function liveDecider(provider: string): Decider {
  return {
    source: `live Jev via ${provider}`,
    pickModel: (task) => ask<ModelPickAnswer>({ gate: 'model', task }),
    gateTool: (task, call) => ask<ToolGateAnswer>({ gate: 'tool', task, call }),
    checkDone: (task, evidence, answer) => ask<DoneAnswer>({ gate: 'done', task, evidence, answer }),
  }
}
