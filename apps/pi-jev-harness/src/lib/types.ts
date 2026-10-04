export type ModelTier = 'fast' | 'powerful'
export type Mode = 'scripted' | 'live'
export type Provider = 'openrouter' | 'typesafe'

export interface ToolCall {
  tool: string
  args: string
}

export interface ScriptedTool extends ToolCall {
  /** Canned Noul: probability that this call is unsafe. */
  unsafe: number
  /** Canned result returned when the harness allows the call. Nothing really runs. */
  result: string
}

export interface SeedTask {
  id: string
  title: string
  shape: string
  task: string
  script: {
    model: { probabilities: Record<ModelTier, number>; complexity: number }
    tools: ScriptedTool[]
    answer: string
    /** Canned done Score on the 0–4 rubric. */
    done: number
  }
}

export interface Policy {
  /** Below this Jev Choice confidence the harness routes to the powerful model. */
  modelConfidenceFloor: number
  /** At or above this normalized complexity (score / 4) the harness routes to the powerful model. */
  complexityCutoff: number
  /** At or above this Noul the tool call is denied. */
  toolDenyCutoff: number
  /** At or above this normalized done score (score / 4) the answer is handed back. */
  doneCutoff: number
}

// --- Jev answers (same shape for scripted fixtures and live calls) ----------

export interface ModelPickAnswer {
  choice: ModelTier
  confidence: number
  probabilities: Record<ModelTier, number>
  /** Expected complexity on the 0–4 rubric. */
  complexity: number
}

export interface ToolGateAnswer {
  /** Probability that the call is unsafe. */
  noul: number
}

export interface DoneAnswer {
  /** Expected done score on the 0–4 rubric. */
  score: number
  confidence?: number
}

export interface Decider {
  source: string
  pickModel(task: string): Promise<ModelPickAnswer>
  gateTool(task: string, call: ToolCall): Promise<ToolGateAnswer>
  checkDone(task: string, evidence: string[], answer: string): Promise<DoneAnswer>
}

// --- timeline -----------------------------------------------------------------

export type TimelineEvent =
  | {
      kind: 'model'
      hook: 'before_agent_start'
      answer: ModelPickAnswer
      model: ModelTier
      reason: string
    }
  | {
      kind: 'tool'
      hook: 'tool_call'
      call: ToolCall
      answer: ToolGateAnswer
      verdict: 'allow' | 'deny'
      result: string
    }
  | {
      kind: 'done'
      hook: 'agent_end'
      answer: DoneAnswer
      normalized: number
      verdict: 'done' | 'keep_going'
      draft: string
      note: string
    }

export interface StatusResponse {
  live: boolean
  provider: Provider | null
}

export type GateRequest =
  | { gate: 'model'; task: string }
  | { gate: 'tool'; task: string; call: ToolCall }
  | { gate: 'done'; task: string; evidence: string[]; answer: string }
