export const meta = {
  name: 'cli-name-tournament',
  description: 'Brainstorm CLI names on cheap models, run a pairwise bracket on Opus, keep the top 3',
  phases: [{ title: 'Brainstorm' }, { title: 'Bracket' }, { title: 'Final' }],
}

const NAMES = { type: 'object', required: ['names'], properties: { names: { type: 'array', items: { type: 'string' } } } }
const PICK = { type: 'object', required: ['winner', 'reason'], properties: { winner: { type: 'string' }, reason: { type: 'string' } } }
const RUBRIC = `Rubric: ${args.constraint} Then: easy to type, says what it does, memorable.`

// Fan out: three styles in three clean contexts, on cheap models.
phase('Brainstorm')
const styles = [
  { style: 'playful', model: 'haiku' },
  { style: 'unix', model: 'haiku' },
  { style: 'descriptive', model: 'sonnet' },
]
const pools = await parallel(styles.map(s => () =>
  agent(`Brainstorm 4 ${s.style} names for this CLI: ${args.tool}`, { label: `brainstorm: ${s.style}`, model: s.model, schema: NAMES }),
))
let field = [...new Set(pools.filter(Boolean).flatMap(p => p.names))]
log(`${field.length} unique names enter the bracket`)

// Tournament: comparative judgment, one fresh judge per bout. Loop until 3 remain.
phase('Bracket')
let round = 1
while (field.length > 3) {
  const pairs = []
  for (let i = 0; i + 1 < field.length; i += 2) pairs.push([field[i], field[i + 1]])
  const bye = field.length % 2 ? [field[field.length - 1]] : []
  const picks = await pipeline(pairs, ([a, b]) =>
    agent(`Which is the better name for ${args.tool}: "${a}" or "${b}"? ${RUBRIC}`, { label: `r${round}: ${a} vs ${b}`, model: 'opus', schema: PICK }),
  )
  field = [...picks.filter(Boolean).map(p => p.winner), ...bye]
  log(`Round ${round} done: ${field.join(', ')}`)
  round++
}

// Independent judge: never proposed or judged any of these names.
phase('Final')
const final = await agent(`Rank the finalists for ${args.tool}. You did not propose or judge any of them. ${RUBRIC}\nCandidates: ${field.join(', ')}`, {
  label: 'judge: final ranking',
  model: 'opus',
  schema: { type: 'object', required: ['ranking'], properties: { ranking: { type: 'array', items: { type: 'string' } } } },
})
return { top3: final ? final.ranking : field }
