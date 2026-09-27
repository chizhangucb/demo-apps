import agentLoop from '../../data/agent-loop.architecture.json'
import ciCd from '../../data/ci-cd.architecture.json'
import dataPipeline from '../../data/data-pipeline.architecture.json'
import webCacheMiss from '../../data/web-cache-miss.architecture.json'

export interface Seed {
  slug: string
  name: string
  blurb: string
  /** Paste-box keywords that route a description to this canned IR. */
  keywords: string[]
  ir: unknown
}

export const SEEDS: Seed[] = [
  {
    slug: 'web-cache-miss',
    name: 'Web + Redis + Postgres',
    blurb: 'Read path with a cache-miss fallback',
    keywords: ['redis', 'cache', 'postgres', 'cache-miss', 'cache miss', 'load balancer', 'cdn'],
    ir: webCacheMiss,
  },
  {
    slug: 'ci-cd',
    name: 'CI/CD workflow',
    blurb: 'Push → build → scan → GitOps release',
    keywords: ['ci', 'cd', 'deploy', 'pipeline', 'github actions', 'argo', 'registry', 'release'],
    ir: ciCd,
  },
  {
    slug: 'agent-loop',
    name: 'Agent tool-call loop',
    blurb: 'LLM plans, tools act, results loop back',
    keywords: ['agent', 'llm', 'tool', 'tool call', 'claude', 'mcp', 'sandbox'],
    ir: agentLoop,
  },
  {
    slug: 'data-pipeline',
    name: 'Data pipeline',
    blurb: 'Events → Kafka → warehouse → BI',
    keywords: ['kafka', 'etl', 'warehouse', 'analytics', 'dbt', 'events', 'lake', 'bigquery', 'snowflake'],
    ir: dataPipeline,
  },
]

/** Scores a free-form description against each seed's keywords. */
export function matchSeed(text: string): Seed | undefined {
  const t = text.toLowerCase()
  let best: Seed | undefined
  let bestScore = 0
  for (const s of SEEDS) {
    const score = s.keywords.reduce((n, k) => n + (new RegExp(`\\b${k.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`).test(t) ? 1 : 0), 0)
    if (score > bestScore) {
      best = s
      bestScore = score
    }
  }
  return best
}
