import { describe, expect, test } from 'bun:test'
import { runHarness } from '../src/lib/harness'
import { DEFAULT_POLICY } from '../src/lib/policy'
import { SEED_TASKS, agentScriptFor, scriptedDecider } from '../src/lib/scripted'
import type { TimelineEvent } from '../src/lib/types'

async function run(id: string, policy = DEFAULT_POLICY) {
  const seed = SEED_TASKS.find((s) => s.id === id)!
  const events = await runHarness(seed.task, agentScriptFor(seed.task), policy, scriptedDecider(), () => {})
  const model = events.find((e): e is Extract<TimelineEvent, { kind: 'model' }> => e.kind === 'model')!
  const tools = events.filter((e): e is Extract<TimelineEvent, { kind: 'tool' }> => e.kind === 'tool')
  const done = events.find((e): e is Extract<TimelineEvent, { kind: 'done' }> => e.kind === 'done')!
  return { model: model.model, tools: tools.map((t) => t.verdict), done: done.verdict }
}

describe('scripted harness seeds', () => {
  test('safe read → fast, allow, done', async () => {
    expect(await run('readme-summary')).toEqual({ model: 'fast', tools: ['allow'], done: 'done' })
  })
  test('risky delete is denied; low confidence routes to powerful', async () => {
    expect(await run('disk-cleanup')).toEqual({ model: 'powerful', tools: ['allow', 'deny'], done: 'done' })
  })
  test('complex task → powerful; unfinished answer keeps going', async () => {
    expect(await run('jwt-refactor')).toEqual({ model: 'powerful', tools: ['allow', 'allow', 'deny'], done: 'keep_going' })
  })
  test('nudging the tool cutoff flips a verdict', async () => {
    const r = await run('jwt-refactor', { ...DEFAULT_POLICY, toolDenyCutoff: 0.3 })
    expect(r.tools).toEqual(['allow', 'deny', 'deny'])
  })
  test('pasted task runs on heuristics with no network', async () => {
    const task = 'Delete the old build folders and clean up tmp'
    const events = await runHarness(task, agentScriptFor(task), DEFAULT_POLICY, scriptedDecider(), () => {})
    expect(events.map((e) => e.kind)).toEqual(['model', 'tool', 'tool', 'done'])
    expect(events.some((e) => e.kind === 'tool' && e.verdict === 'deny')).toBe(true)
  })
})
