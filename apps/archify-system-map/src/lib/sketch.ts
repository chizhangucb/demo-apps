// Offline "arrow sketch" → Archify IR. Lets the paste box produce a real map
// without an API key: one edge per line, e.g. `Browser -> API: HTTPS`.
import type { ArchitectureIR, Component, ComponentType, Connection } from '@shared/archify'

const TYPE_HINTS: [ComponentType, RegExp][] = [
  ['security', /\b(auth|oauth|oidc|iam|vault|secrets?|waf|firewall|guard|policy|jwt|sso)\b/i],
  ['database', /\b(db|database|postgres|postgresql|mysql|redis|cache|mongo|dynamo|sqlite|warehouse|bigquery|snowflake|vector|store)\b/i],
  ['messagebus', /\b(queue|kafka|sqs|sns|pubsub|pub\/sub|rabbit|nats|bus|stream|topic|kinesis)\b/i],
  ['frontend', /\b(browser|ui|web ?app|frontend|spa|mobile|ios|android|dashboard|client app)\b/i],
  ['cloud', /\b(cdn|s3|bucket|lambda|load ?balancer|lb|gateway|k8s|kubernetes|cloud|vercel|edge|dns)\b/i],
  ['external', /\b(user|users|customer|stripe|twilio|third[- ]party|external|partner|github|slack|email)\b/i],
]

export function inferType(label: string): ComponentType {
  return TYPE_HINTS.find(([, re]) => re.test(label))?.[0] ?? 'backend'
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^(\d)/, 'n$1') || 'node'

const ARROW = /\s*(?:-{1,2}>|=>|→)\s*/

export function hasArrows(text: string): boolean {
  return text.split('\n').some((l) => ARROW.test(l))
}

/** Parses `A -> B -> C: label` lines (optionally `# Title` first) into architecture IR. */
export function sketchToIR(text: string): ArchitectureIR {
  const components = new Map<string, Component>()
  const connections: Connection[] = []
  let title = 'Sketched system'
  const ensure = (raw: string) => {
    const m = raw.trim().match(/^(.*?)\s*(?:\((.*)\))?$/)
    const label = (m?.[1] || raw).trim().slice(0, 28)
    const sublabel = m?.[2]?.trim()
    const id = slug(label)
    if (!components.has(id)) components.set(id, { id, type: inferType(`${label} ${sublabel ?? ''}`), label, ...(sublabel ? { sublabel } : {}) })
    return id
  }
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('#')) {
      title = line.replace(/^#+\s*/, '') || title
      continue
    }
    if (!ARROW.test(line)) continue
    const [chain, ...labelParts] = line.split(/:\s+/)
    const label = labelParts.join(': ').trim()
    const hops = chain.split(ARROW).filter(Boolean).map(ensure)
    for (let i = 0; i < hops.length - 1; i++) {
      if (hops[i] === hops[i + 1]) continue
      if (connections.some((c) => c.from === hops[i] && c.to === hops[i + 1])) continue
      connections.push({ from: hops[i], to: hops[i + 1], ...(label && i === hops.length - 2 ? { label: label.slice(0, 22) } : {}) })
    }
  }
  if (connections.length) connections[0].variant = 'emphasis'
  for (const c of connections) {
    const t = components.get(c.to)?.type
    if (!c.variant && (t === 'security' || components.get(c.from)?.type === 'security')) c.variant = 'security'
    else if (!c.variant && t === 'messagebus') c.variant = 'dashed'
  }
  return {
    schema_version: 1,
    diagram_type: 'architecture',
    meta: { title, quality_profile: 'showcase', animation: 'trace' },
    components: [...components.values()],
    connections,
  }
}
