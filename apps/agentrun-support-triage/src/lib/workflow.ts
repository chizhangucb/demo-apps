// The support-triage workflow as an AgentRun v2 document (@parcha/agentrun-dsl).
// Plain data — the studio renders it in the "Workflow DSL" tab and the server
// hands the same object to `runWorkflow`.

export const UNSURE_GATE = 0.6

export const ROUTE_QUESTION =
  'Given the support ticket and the knowledge-base hits, how should support handle this ticket?'

export const supportTriageWorkflow = {
  v: 2,
  name: 'support-triage',
  schemas: {
    Input: {
      type: 'object',
      additionalProperties: false,
      required: ['ticket'],
      properties: { ticket: { type: 'string', minLength: 1 } },
    },
    KbHits: {
      type: 'object',
      additionalProperties: false,
      required: ['hits'],
      properties: {
        hits: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'title', 'snippet', 'score'],
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              snippet: { type: 'string' },
              score: { type: 'number' },
            },
          },
        },
      },
    },
    Investigation: {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'findings', 'needs_human', 'reply'],
      properties: {
        summary: { type: 'string', description: 'What the evidence shows, in one or two sentences.' },
        findings: { type: 'array', items: { type: 'string' }, description: 'Short evidence bullet points.' },
        needs_human: {
          type: 'boolean',
          description: 'True when a person must own the next step (outage, data risk, policy exception).',
        },
        reply: { type: 'string', description: 'The reply to send the customer.' },
      },
    },
    Result: {
      type: 'object',
      additionalProperties: false,
      required: ['disposition', 'reply'],
      properties: {
        disposition: { type: 'string', enum: ['auto_resolved', 'resolved_after_investigation'] },
        reply: { type: 'string' },
      },
    },
  },
  input: { schemaId: 'Input' },
  output: { schemaId: 'Result', path: 'outcome' },
  root: {
    node: 'chain',
    steps: [
      {
        node: 'call',
        label: 'tool-search',
        via: 'tool',
        tool: 'kb.search',
        args: { query: '{ticket}' },
        out: 'KbHits',
        as: 'kb',
        deadline_s: 20,
      },
      {
        node: 'route',
        label: 'jev-judge',
        as: 'routing',
        state: { ticket: '{ticket}', kb_hits: '{kb.hits}' },
        instructions: ROUTE_QUESTION,
        branches: {
          resolve: {
            criteria: 'A knowledge-base hit fully answers the ticket; it is safe to auto-reply with it.',
            body: {
              node: 'code',
              label: 'auto-resolve',
              code: "s => ({ outcome: { disposition: 'auto_resolved', reply: s.kb.hits.length ? 'Here is how to fix this: ' + s.kb.hits[0].snippet + ' (' + s.kb.hits[0].title + ')' : 'Thanks for reaching out — this is covered in our help center.' } })",
            },
          },
          investigate: {
            criteria:
              'Probably solvable by support, but only after checking account, billing or log evidence.',
            body: {
              node: 'chain',
              steps: [
                {
                  node: 'agent',
                  label: 'investigate',
                  instructions:
                    'Investigate the ticket with the host tools. Summarise the evidence, list findings, decide whether a person must own the next step, and draft the customer reply.',
                  state: { ticket: '{ticket}', kb_hits: '{kb.hits}' },
                  tools: ['account.lookup', 'billing.ledger', 'logs.search', 'status.incidents'],
                  out: 'Investigation',
                  as: 'investigation',
                  effort: 'low',
                },
                {
                  node: 'escalate',
                  label: 'escalate-after-investigation',
                  when: { predicate: 'field_true', path: 'investigation.needs_human' },
                  kind: 'human_review',
                  stage: 'investigate',
                  summary: 'The investigate agent found evidence that a person must own this ticket.',
                },
                {
                  node: 'code',
                  label: 'resolve-after-investigation',
                  code: "s => ({ outcome: { disposition: 'resolved_after_investigation', reply: s.investigation.reply } })",
                },
              ],
            },
          },
          escalate: {
            criteria:
              'Legal, privacy, security, churn risk, or anything support must not action alone — a human must own it.',
            body: {
              node: 'escalate',
              label: 'escalate-human',
              when: { predicate: 'field_equals', path: 'routing.taken', value: 'escalate' },
              kind: 'human_review',
              stage: 'triage',
              summary: 'Jev routed this ticket to a human (or was not confident enough to automate it).',
            },
          },
        },
        unsure: { branch: 'escalate', gte: UNSURE_GATE },
      },
    ],
  },
} as const
