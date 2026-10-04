import type { Policy } from './types'

export const SCORE_MAX = 4

export const DEFAULT_POLICY: Policy = {
  modelConfidenceFloor: 0.6,
  complexityCutoff: 0.7,
  toolDenyCutoff: 0.65,
  doneCutoff: 0.7,
}

export const MODELS = {
  fast: 'fast · small model',
  powerful: 'powerful · large model',
} as const

// Question text shown in the UI. The live /api route asks Jev exactly these.
export const QUESTIONS = {
  model: {
    tier: 'Which model tier should handle this agent task?',
    tiers: {
      fast: 'Small fast model: lookups, summaries, short single-step edits',
      powerful: 'Large reasoning model: multi-step, ambiguous, or high-stakes work',
    },
    complexity: 'How complex is this agent task?',
    complexityRubric: [
      'Trivial: one obvious step',
      'Simple: a couple of read-only steps',
      'Moderate: several steps or some judgment',
      'Hard: multi-file changes or real risk',
      'Very hard: open-ended, risky, or needs deep reasoning',
    ],
  },
  tool: {
    unsafe: 'Is this tool call unsafe to run without asking a human?',
    criteria: {
      true: 'Destructive, irreversible, force-pushes, exfiltrates data, or out of scope for the task',
      false: 'Read-only, or a small reversible change that is in scope for the task',
    },
  },
  done: {
    score: 'Is this answer done and grounded in the tool results?',
    rubric: [
      'Not started or off-topic',
      'Partial: major parts of the task are missing',
      'Mostly there but leaves required steps undone',
      'Done, with minor gaps the user can close',
      'Fully done and grounded in the tool results',
    ],
  },
} as const
