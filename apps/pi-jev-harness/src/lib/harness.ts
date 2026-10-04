// A thin Pi-shaped harness loop. Pi extensions hook `before_agent_start`,
// `tool_call` and `agent_end`; this runner fires the same three hooks and asks
// Jev one cheap question at each. The "agent" itself is canned (planned tool
// calls + draft answer) — no Pi CLI, no real tools, no side effects.
import { MODELS, SCORE_MAX } from './policy'
import type { Decider, ModelTier, Policy, ScriptedTool, TimelineEvent, ToolCall } from './types'

export interface AgentScript {
  tools: (ToolCall & { result: string })[]
  answer: string
}

export function decideModel(
  answer: { choice: ModelTier; confidence: number; complexity: number },
  policy: Policy,
): { model: ModelTier; reason: string } {
  const complexity = answer.complexity / SCORE_MAX
  if (complexity >= policy.complexityCutoff) {
    return { model: 'powerful', reason: `complexity ${pct(complexity)} ≥ ${pct(policy.complexityCutoff)} → route to powerful` }
  }
  if (answer.confidence < policy.modelConfidenceFloor) {
    return { model: 'powerful', reason: `confidence ${pct(answer.confidence)} < floor ${pct(policy.modelConfidenceFloor)} → route to powerful` }
  }
  return { model: answer.choice, reason: `confident (${pct(answer.confidence)}) and complexity ${pct(complexity)} → use Jev's pick` }
}

export async function runHarness(
  task: string,
  script: AgentScript,
  policy: Policy,
  decider: Decider,
  onEvent: (e: TimelineEvent) => void | Promise<void>,
): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = []
  const emit = async (e: TimelineEvent) => {
    events.push(e)
    await onEvent(e)
  }

  // Gate 1 — before_agent_start: pick the model for this request.
  const pick = await decider.pickModel(task)
  const { model, reason } = decideModel(pick, policy)
  await emit({ kind: 'model', hook: 'before_agent_start', answer: pick, model, reason })

  // Gate 2 — tool_call: allow or deny each call the agent proposes.
  const evidence: string[] = []
  for (const call of script.tools) {
    const gate = await decider.gateTool(task, { tool: call.tool, args: call.args })
    const verdict = gate.noul >= policy.toolDenyCutoff ? 'deny' : 'allow'
    const result = verdict === 'allow' ? call.result : `(blocked by harness: unsafe ${pct(gate.noul)} ≥ ${pct(policy.toolDenyCutoff)} — nothing ran)`
    evidence.push(`${call.tool}(${call.args}) → ${verdict === 'allow' ? call.result : 'DENIED'}`)
    await emit({ kind: 'tool', hook: 'tool_call', call: { tool: call.tool, args: call.args }, answer: gate, verdict, result })
  }

  // Gate 3 — agent_end: is the draft answer done and grounded?
  const done = await decider.checkDone(task, evidence, script.answer)
  const normalized = done.score / SCORE_MAX
  const finished = normalized >= policy.doneCutoff
  await emit({
    kind: 'done',
    hook: 'agent_end',
    answer: done,
    normalized,
    verdict: finished ? 'done' : 'keep_going',
    draft: script.answer,
    note: finished
      ? `Handed back to the user (answered by ${MODELS[model]}).`
      : 'Keep going: the harness would queue another turn with "finish the missing steps before handing back".',
  })
  return events
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`
}

export function scriptOf(tools: ScriptedTool[], answer: string): AgentScript {
  return { tools: tools.map(({ tool, args, result }) => ({ tool, args, result })), answer }
}
