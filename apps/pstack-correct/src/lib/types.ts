export type Layer = "architecture" | "types" | "checks"

/** Strength ladder from pstack: strongest first. Prose is the symptom, not a fix. */
export type Mechanism = "unrepresentable" | "lint" | "helper" | "runtime" | "prose"

export type Snippet = { caption: string; lines: string[] }

export type Pack = {
  id: string
  name: string
  tagline: string
  notes: string[]
  keywords: string[]
  pattern: string
  wrongFix: string
  fix: {
    layer: Layer
    mechanism: Exclude<Mechanism, "prose">
    title: string
    summary: string
    whyNotWeaker: string
  }
  before: Snippet
  after: Snippet
}

export type NoteHit = {
  note: string
  keywords: string[]
  /** Closest canned note when token overlap carried the match. */
  similarTo?: string
  score: number
}

export type Cluster = { pack: Pack; hits: NoteHit[] }

export type MatchResult =
  | { kind: "empty" }
  | { kind: "no-pattern"; notes: string[]; oneOffs: NoteHit[]; packIds: (string | null)[] }
  | { kind: "pattern"; clusters: Cluster[]; leftAlone: string[] }
