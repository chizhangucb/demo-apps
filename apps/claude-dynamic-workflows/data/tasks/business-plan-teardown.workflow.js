export const meta = {
  name: 'plan-teardown',
  description: 'Investor, customer and competitor critique the plan in clean contexts, a verifier checks each critique, a synthesizer merges',
  phases: [{ title: 'Critique' }, { title: 'Verify' }, { title: 'Synthesize' }],
}

const POINTS = {
  type: 'object',
  required: ['points'],
  properties: {
    points: {
      type: 'array',
      items: { type: 'object', required: ['point', 'quote'], properties: { point: { type: 'string' }, quote: { type: 'string' }, severity: { enum: ['high', 'medium', 'low'] } } },
    },
  },
}
const lenses = ['investor', 'customer', 'competitor']

// Fan out: each lens gets its own context, so critiques cannot blur together.
phase('Critique')
const critiques = await parallel(lenses.map(lens => () =>
  agent(`You are a skeptical ${lens}. Tear this plan apart. Quote the plan for every point. ${args.constraint}\n\n${args.plan}`, {
    label: `critic: ${lens}`,
    model: 'sonnet',
    schema: POINTS,
  }),
))

// Adversarial verification: a separate agent per critique, never its author.
phase('Verify')
const verified = await pipeline(critiques, (critique, i) =>
  agent(`You did not write this critique. Check every point against the plan text: drop points the plan already answers, points without a real quote, and advice that breaks this rule: ${args.constraint}\n\n${JSON.stringify(critique.points)}`, {
    label: `verify: ${lenses[i]}`,
    model: 'opus',
    schema: POINTS,
  }),
)
const kept = verified.flatMap((v, i) => (v ? v.points.map(p => ({ lens: lenses[i], ...p })) : []))
log(`${kept.length} points survived verification`)

// Barrier, then synthesize the structured outputs.
phase('Synthesize')
const report = await agent(`Merge these verified points into one ranked teardown. Keep each lens visible. ${args.constraint}\n\n${JSON.stringify(kept)}`, {
  label: 'synthesize',
  model: 'opus',
  schema: { type: 'object', required: ['top'], properties: { top: { type: 'array', items: { type: 'string' } } } },
})
return report
