export const meta = {
  name: 'verify-blog-claims',
  description: 'Extract every technical claim, check each one in its own agent (code claims in a worktree), then a skeptic filters false positives',
  phases: [{ title: 'Extract' }, { title: 'Check' }, { title: 'Skeptic' }],
}

const CLAIMS = {
  type: 'object',
  required: ['claims'],
  properties: { claims: { type: 'array', items: { type: 'object', required: ['id', 'line', 'text', 'code'], properties: { id: { type: 'string' }, line: { type: 'number' }, text: { type: 'string' }, code: { type: 'boolean' } } } } },
}
const VERDICT = {
  type: 'object',
  required: ['id', 'verdict', 'evidence'],
  properties: { id: { type: 'string' }, verdict: { enum: ['supported', 'wrong', 'unclear'] }, evidence: { type: 'string' } },
}

phase('Extract')
const found = await agent(`List every technical claim in this draft, one per item, with its line number. Mark claims that need the code to check.\n\n${args.draft}`, {
  label: 'extract claims',
  model: 'haiku',
  schema: CLAIMS,
})

// Deep verification: one checker per claim. Code claims get their own worktree of the repo snapshot.
phase('Check')
const checks = await pipeline(found.claims, claim =>
  agent(`Check one claim against ${args.repo}. ${args.constraint}\nClaim ${claim.id} (line ${claim.line}): ${claim.text}`,
    claim.code
      ? { label: `check ${claim.id}`, model: 'sonnet', isolation: 'worktree', schema: VERDICT }
      : { label: `check ${claim.id}`, model: 'haiku', schema: VERDICT },
  ),
)
const done = checks.filter(Boolean)
log(`${done.length} of ${found.claims.length} claims checked`)
const flagged = done.filter(c => c.verdict !== 'supported')

// Skeptic: wrote none of the checks, tries to refute every flag.
phase('Skeptic')
const review = await agent(`You wrote none of these checks. Try to refute each flagged verdict and drop false positives.\n\n${JSON.stringify(flagged)}`, {
  label: 'skeptic',
  model: 'opus',
  schema: { type: 'object', required: ['confirmed', 'dropped'], properties: { confirmed: { type: 'array', items: { type: 'string' } }, dropped: { type: 'array', items: { type: 'string' } } } },
})
return { checked: done.length, total: found.claims.length, wrong: review ? review.confirmed : flagged.map(c => c.id) }
