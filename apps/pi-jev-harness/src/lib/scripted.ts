// Zero-network path: canned Jev answers for the seeded tasks, and small keyword
// heuristics (plus a canned agent plan) for pasted tasks.
import tasksData from '../../data/tasks.json'
import { scriptOf, type AgentScript } from './harness'
import type { Decider, ModelPickAnswer, ScriptedTool, SeedTask, ToolCall } from './types'

export const SEED_TASKS = tasksData as SeedTask[]

const DESTRUCTIVE = ['rm -rf', 'rm ', 'delete', 'drop ', 'truncate', '--force', 'force', 'chmod 777', 'curl ', 'wipe', 'format', 'secret', '.env']
const MUTATING = ['edit', 'write', 'mv ', 'install', 'commit', 'push']
const COMPLEX = ['refactor', 'migrate', 'design', 'architecture', 'debug', 'tests', 'performance', 'security', 'and then', 'across']
const ACTION = ['delete', 'clean', 'remove', 'deploy', 'push', 'fix', 'update', 'change', 'write', 'install']

const hits = (text: string, words: string[]) => words.filter((w) => text.includes(w)).length
const round = (x: number) => Math.round(x * 100) / 100

export function seedFor(task: string): SeedTask | undefined {
  return SEED_TASKS.find((s) => s.task === task.trim())
}

export function heuristicModel(task: string): ModelPickAnswer {
  const text = task.toLowerCase()
  const complexity = Math.min(4, 0.6 + hits(text, COMPLEX) * 0.9 + hits(text, ACTION) * 0.4 + Math.min(1, task.length / 300))
  const powerful = Math.min(0.92, Math.max(0.08, complexity / 4.2))
  const probabilities = { fast: round(1 - powerful), powerful: round(powerful) }
  const choice = probabilities.fast >= probabilities.powerful ? 'fast' : 'powerful'
  return { choice, confidence: Math.max(probabilities.fast, probabilities.powerful), probabilities, complexity: round(complexity) }
}

export function heuristicUnsafe(call: ToolCall): number {
  const text = `${call.tool} ${call.args}`.toLowerCase()
  return round(Math.min(0.97, 0.04 + hits(text, DESTRUCTIVE) * 0.45 + hits(text, MUTATING) * 0.17))
}

/** Canned agent plan for a pasted task: one read, plus one risky call if the task asks for an action. */
export function heuristicScript(task: string): AgentScript {
  const text = task.toLowerCase()
  const tools: ScriptedTool[] = [
    { tool: 'read', args: 'README.md', unsafe: 0, result: '(simulated) 42 lines of project overview' },
  ]
  if (hits(text, ['delete', 'clean', 'remove', 'wipe'])) {
    tools.push({ tool: 'bash', args: 'rm -rf ./build ./tmp', unsafe: 0, result: '(simulated) removed 2 folders' })
  } else if (hits(text, ['push', 'deploy', 'ship'])) {
    tools.push({ tool: 'bash', args: 'git push --force origin main', unsafe: 0, result: '(simulated) pushed' })
  } else if (hits(text, ACTION)) {
    tools.push({ tool: 'edit', args: 'src/index.ts', unsafe: 0, result: '(simulated) patch applied in memory: +8 −2' })
  }
  return scriptOf(tools, `Here is a first pass at: "${task.trim().slice(0, 120)}". I looked at README.md and proposed the change above; review before applying.`)
}

export function agentScriptFor(task: string): AgentScript {
  const seed = seedFor(task)
  return seed ? scriptOf(seed.script.tools, seed.script.answer) : heuristicScript(task)
}

export function scriptedDecider(): Decider {
  return {
    source: 'scripted',
    async pickModel(task) {
      const seed = seedFor(task)
      if (!seed) return heuristicModel(task)
      const { probabilities, complexity } = seed.script.model
      const choice = probabilities.fast >= probabilities.powerful ? 'fast' : 'powerful'
      return { choice, confidence: probabilities[choice], probabilities, complexity }
    },
    async gateTool(task, call) {
      const canned = seedFor(task)?.script.tools.find((t) => t.tool === call.tool && t.args === call.args)
      return { noul: canned ? canned.unsafe : heuristicUnsafe(call) }
    },
    async checkDone(task, evidence, answer) {
      const seed = seedFor(task)
      if (seed) return { score: seed.script.done }
      const denied = evidence.filter((e) => e.endsWith('DENIED')).length
      const grounded = answer.length > 80 ? 0.6 : 0
      return { score: round(Math.max(0.3, Math.min(4, 2.6 + grounded - denied * 0.9))) }
    },
  }
}
