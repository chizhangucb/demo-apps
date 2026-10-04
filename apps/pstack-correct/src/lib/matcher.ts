import type { Cluster, MatchResult, NoteHit, Pack } from "./types"

/** Below this token overlap a pasted note is not "similar" to a canned one. */
const SIMILARITY_FLOOR = 0.3
/** A pattern needs the same correction at least this many times. */
const MIN_CLUSTER = 2

const STOP = new Set(
  "a an the to of in on it is was again that this there so for with from and or not no you your just use using before after then don't dont do".split(" "),
)

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function normalize(note: string) {
  return note.toLowerCase().replace(/[`"]/g, "")
}

function keywordHits(text: string, keywords: string[]) {
  return keywords.filter((k) => {
    if (k.endsWith("*")) return new RegExp(`\\b${escape(k.slice(0, -1))}\\w*`).test(text)
    if (/^[\w ]+$/.test(k)) return new RegExp(`\\b${escape(k)}\\b`).test(text)
    return text.includes(k)
  })
}

function tokens(text: string) {
  return new Set(text.split(/[^a-z0-9_?]+/).filter((t) => t.length > 1 && !STOP.has(t)))
}

function jaccard(a: Set<string>, b: Set<string>) {
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

export function splitNotes(text: string) {
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
}

/** Score one note against one pack: keyword hits plus a bonus for near-duplicate canned notes. */
export function scoreNote(note: string, pack: Pack): NoteHit {
  const text = normalize(note)
  const keywords = keywordHits(text, pack.keywords)
  const mine = tokens(text)
  let best = 0
  let similarTo: string | undefined
  for (const canned of pack.notes) {
    const sim = jaccard(mine, tokens(normalize(canned)))
    if (sim > best) [best, similarTo] = [sim, canned]
  }
  const similar = best >= SIMILARITY_FLOOR
  return {
    note,
    keywords,
    similarTo: similar ? similarTo : undefined,
    score: keywords.length + (similar ? 2 : 0),
  }
}

/**
 * Assign each note to the pack it scores highest on, then keep only packs
 * that collected MIN_CLUSTER or more notes. A single correction is a one-off:
 * it gets no environment fix.
 */
export function match(notes: string[], packs: Pack[]): MatchResult {
  if (notes.length === 0) return { kind: "empty" }

  const assigned = notes.map((note) => {
    let best: { pack: Pack; hit: NoteHit } | null = null
    for (const pack of packs) {
      const hit = scoreNote(note, pack)
      if (hit.score > 0 && (!best || hit.score > best.hit.score)) best = { pack, hit }
    }
    return best
  })

  const byPack = new Map<string, Cluster>()
  for (const a of assigned) {
    if (!a) continue
    const c = byPack.get(a.pack.id) ?? { pack: a.pack, hits: [] }
    c.hits.push(a.hit)
    byPack.set(a.pack.id, c)
  }

  const clusters = [...byPack.values()]
    .filter((c) => c.hits.length >= MIN_CLUSTER)
    .sort((x, y) => y.hits.length - x.hits.length || total(y) - total(x))

  if (clusters.length === 0) {
    return {
      kind: "no-pattern",
      notes,
      oneOffs: assigned.flatMap((a) => (a ? [a.hit] : [])),
      packIds: assigned.map((a) => a?.pack.id ?? null),
    }
  }

  const clustered = new Set(clusters.flatMap((c) => c.hits.map((h) => h.note)))
  return { kind: "pattern", clusters, leftAlone: notes.filter((n) => !clustered.has(n)) }
}

function total(c: Cluster) {
  return c.hits.reduce((s, h) => s + h.score, 0)
}
