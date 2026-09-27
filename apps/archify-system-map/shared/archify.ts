// Archify architecture IR (schema_version 1) — a typed subset of
// https://github.com/tt-a1i/archify/blob/main/archify/schemas/architecture.schema.json (MIT).
// Shared by the browser studio and the server-side generate route.

export const COMPONENT_TYPES = [
  'frontend',
  'backend',
  'database',
  'cloud',
  'security',
  'messagebus',
  'external',
] as const
export type ComponentType = (typeof COMPONENT_TYPES)[number]

export const VARIANTS = ['default', 'emphasis', 'security', 'dashed'] as const
export type Variant = (typeof VARIANTS)[number]

export const SIDES = ['left', 'right', 'top', 'bottom'] as const
export type Side = (typeof SIDES)[number]

export const CARD_DOTS = ['cyan', 'emerald', 'violet', 'amber', 'rose', 'orange', 'slate'] as const
export type CardDot = (typeof CARD_DOTS)[number]

export type Point = [number, number]

export interface Component {
  id: string
  type: ComponentType
  label: string
  sublabel?: string
  tag?: string
  row?: number
  col?: number
  pos?: Point
  size?: Point
}

export interface Boundary {
  kind: 'region' | 'security-group'
  label: string
  wraps: string[]
  pad?: number
}

export interface Connection {
  id?: string
  from: string
  to: string
  label?: string
  variant?: Variant
  fromSide?: Side
  toSide?: Side
  via?: Point[]
  labelAt?: Point
  labelDx?: number
  labelDy?: number
}

export interface Card {
  dot: CardDot
  title: string
  items: string[]
}

export interface GuidedView {
  id: string
  label: string
  focus: string[]
  note?: string
}

export interface ArchitectureIR {
  schema_version: 1
  diagram_type: 'architecture'
  meta: {
    title: string
    subtitle?: string
    output?: string
    animation?: 'trace' | 'none'
    quality_profile?: 'standard' | 'showcase'
    views?: GuidedView[]
    viewBox?: Point
  }
  layout?: {
    mode: 'grid'
    origin?: Point
    cols?: number
    gapX?: number
    gapY?: number
    cellW?: number
    cellH?: number
  }
  components: Component[]
  boundaries?: Boundary[]
  connections?: Connection[]
  cards?: Card[]
}

export interface Diagnostic {
  severity: 'error' | 'warning'
  code: string
  path: string
  message: string
}

export interface ValidationResult {
  ok: boolean
  diagnostics: Diagnostic[]
  ir?: ArchitectureIR
}

const ID_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/

const ALLOWED_KEYS: Record<string, readonly string[]> = {
  root: ['schema_version', 'diagram_type', 'meta', 'layout', 'components', 'boundaries', 'connections', 'cards'],
  meta: ['title', 'locale', 'subtitle', 'output', 'animation', 'visual_preset', 'quality_profile', 'views', 'legend', 'viewBox'],
  layout: ['mode', 'origin', 'cols', 'gapX', 'gapY', 'cellW', 'cellH'],
  component: ['id', 'type', 'label', 'sublabel', 'tag', 'brand', 'sources', 'row', 'col', 'pos', 'size'],
  boundary: ['kind', 'label', 'wraps', 'pad'],
  connection: [
    'id', 'from', 'to', 'label', 'variant', 'fromSide', 'toSide', 'route', 'via',
    'labelAt', 'labelDx', 'labelDy', 'labelSegment', 'width',
  ],
  card: ['dot', 'title', 'items'],
  view: ['id', 'label', 'focus', 'note'],
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isPoint = (v: unknown): v is Point =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n))

/**
 * Validates an unknown value against the architecture IR contract: shape and
 * enums (mirroring the JSON schema's additionalProperties: false), plus the
 * referential checks Archify's renderer enforces (unique ids, known endpoints).
 */
export function validateArchitecture(input: unknown): ValidationResult {
  const d: Diagnostic[] = []
  const err = (code: string, path: string, message: string) => d.push({ severity: 'error', code, path, message })
  const warn = (code: string, path: string, message: string) => d.push({ severity: 'warning', code, path, message })

  const keys = (obj: Record<string, unknown>, kind: string, path: string) => {
    for (const k of Object.keys(obj)) {
      if (!ALLOWED_KEYS[kind].includes(k)) err('schema/additional-property', `${path}.${k}`, `Unknown property "${k}"`)
    }
  }
  const str = (v: unknown, path: string, required = false) => {
    if (v === undefined) {
      if (required) err('schema/required', path, 'Required string is missing')
      return
    }
    if (typeof v !== 'string' || (required && !v.trim())) err('schema/type', path, 'Expected a non-empty string')
  }
  const enumOf = (v: unknown, allowed: readonly string[], path: string, required = false) => {
    if (v === undefined) {
      if (required) err('schema/required', path, `Required; one of ${allowed.join(', ')}`)
      return
    }
    if (typeof v !== 'string' || !allowed.includes(v)) err('schema/enum', path, `Expected one of ${allowed.join(', ')}`)
  }

  if (!isObj(input)) {
    err('schema/type', '$', 'IR must be a JSON object')
    return { ok: false, diagnostics: d }
  }
  keys(input, 'root', '$')
  if (input.schema_version !== 1) err('schema/const', '$.schema_version', 'Expected schema_version: 1')
  if (input.diagram_type !== 'architecture') err('schema/const', '$.diagram_type', 'Expected diagram_type: "architecture"')

  if (!isObj(input.meta)) err('schema/required', '$.meta', 'meta object is required')
  else {
    keys(input.meta, 'meta', '$.meta')
    str(input.meta.title, '$.meta.title', true)
    str(input.meta.subtitle, '$.meta.subtitle')
    enumOf(input.meta.animation, ['trace', 'none'], '$.meta.animation')
    enumOf(input.meta.quality_profile, ['standard', 'showcase'], '$.meta.quality_profile')
    if (input.meta.viewBox !== undefined && !isPoint(input.meta.viewBox)) err('schema/type', '$.meta.viewBox', 'Expected [width, height]')
  }

  if (input.layout !== undefined) {
    if (!isObj(input.layout)) err('schema/type', '$.layout', 'Expected an object')
    else {
      keys(input.layout, 'layout', '$.layout')
      enumOf(input.layout.mode, ['grid'], '$.layout.mode', true)
    }
  }

  const ids = new Set<string>()
  if (!Array.isArray(input.components) || input.components.length === 0) {
    err('schema/required', '$.components', 'At least one component is required')
  } else {
    input.components.forEach((c, i) => {
      const p = `$.components[${i}]`
      if (!isObj(c)) return err('schema/type', p, 'Expected an object')
      keys(c, 'component', p)
      if (typeof c.id !== 'string' || !ID_RE.test(c.id)) err('schema/pattern', `${p}.id`, 'id must match ^[a-zA-Z][a-zA-Z0-9_-]*$')
      else if (ids.has(c.id)) err('ir/duplicate-id', `${p}.id`, `Duplicate component id "${c.id}"`)
      else ids.add(c.id)
      enumOf(c.type, COMPONENT_TYPES, `${p}.type`, true)
      str(c.label, `${p}.label`, true)
      str(c.sublabel, `${p}.sublabel`)
      str(c.tag, `${p}.tag`)
      if (c.pos !== undefined && !isPoint(c.pos)) err('schema/type', `${p}.pos`, 'Expected [x, y]')
      if (c.size !== undefined && (!isPoint(c.size) || c.size[0] <= 0 || c.size[1] <= 0))
        err('schema/type', `${p}.size`, 'Expected positive [width, height]')
      for (const k of ['row', 'col'] as const) {
        const v = c[k]
        if (v !== undefined && !(Number.isInteger(v) && (v as number) >= 0)) err('schema/type', `${p}.${k}`, 'Expected a non-negative integer')
      }
    })
  }

  if (input.boundaries !== undefined) {
    if (!Array.isArray(input.boundaries)) err('schema/type', '$.boundaries', 'Expected an array')
    else
      input.boundaries.forEach((b, i) => {
        const p = `$.boundaries[${i}]`
        if (!isObj(b)) return err('schema/type', p, 'Expected an object')
        keys(b, 'boundary', p)
        enumOf(b.kind, ['region', 'security-group'], `${p}.kind`, true)
        str(b.label, `${p}.label`, true)
        if (!Array.isArray(b.wraps) || b.wraps.length === 0) err('schema/required', `${p}.wraps`, 'wraps needs at least one id')
        else
          b.wraps.forEach((w, j) => {
            if (typeof w !== 'string' || !ids.has(w)) err('ir/unknown-ref', `${p}.wraps[${j}]`, `Unknown component "${String(w)}"`)
          })
      })
  }

  const edgeKeys = new Set<string>()
  if (input.connections !== undefined) {
    if (!Array.isArray(input.connections)) err('schema/type', '$.connections', 'Expected an array')
    else
      input.connections.forEach((c, i) => {
        const p = `$.connections[${i}]`
        if (!isObj(c)) return err('schema/type', p, 'Expected an object')
        keys(c, 'connection', p)
        for (const end of ['from', 'to'] as const) {
          if (typeof c[end] !== 'string' || !ids.has(c[end] as string))
            err('ir/unknown-ref', `${p}.${end}`, `Unknown component "${String(c[end])}"`)
        }
        if (c.from === c.to) err('ir/self-loop', p, 'A connection cannot start and end on the same component')
        const key = `${String(c.from)}→${String(c.to)}`
        if (edgeKeys.has(key)) warn('ir/duplicate-edge', p, `Duplicate connection ${key}`)
        edgeKeys.add(key)
        str(c.label, `${p}.label`)
        enumOf(c.variant, VARIANTS, `${p}.variant`)
        enumOf(c.fromSide, SIDES, `${p}.fromSide`)
        enumOf(c.toSide, SIDES, `${p}.toSide`)
        if (c.via !== undefined && !(Array.isArray(c.via) && c.via.every(isPoint))) err('schema/type', `${p}.via`, 'Expected [[x, y], ...]')
        if (c.labelAt !== undefined && !isPoint(c.labelAt)) err('schema/type', `${p}.labelAt`, 'Expected [x, y]')
      })
  }

  if (input.cards !== undefined) {
    if (!Array.isArray(input.cards)) err('schema/type', '$.cards', 'Expected an array')
    else
      input.cards.forEach((c, i) => {
        const p = `$.cards[${i}]`
        if (!isObj(c)) return err('schema/type', p, 'Expected an object')
        keys(c, 'card', p)
        enumOf(c.dot, CARD_DOTS, `${p}.dot`, true)
        str(c.title, `${p}.title`, true)
        if (!Array.isArray(c.items) || !c.items.every((s) => typeof s === 'string')) err('schema/type', `${p}.items`, 'Expected string[]')
      })
  }

  const meta = isObj(input.meta) ? input.meta : undefined
  if (meta?.views !== undefined) {
    if (!Array.isArray(meta.views) || meta.views.length > 5) err('schema/type', '$.meta.views', 'Expected up to 5 guided views')
    else
      meta.views.forEach((v, i) => {
        const p = `$.meta.views[${i}]`
        if (!isObj(v)) return err('schema/type', p, 'Expected an object')
        keys(v, 'view', p)
        str(v.label, `${p}.label`, true)
        if (!Array.isArray(v.focus) || v.focus.length === 0) err('schema/required', `${p}.focus`, 'focus needs at least one id')
        else
          v.focus.forEach((f, j) => {
            if (typeof f !== 'string' || !ids.has(f)) err('ir/unknown-ref', `${p}.focus[${j}]`, `Unknown component "${String(f)}"`)
          })
      })
  }

  if (Array.isArray(input.components) && input.components.length > 14) {
    warn('quality/too-many-nodes', '$.components', 'Archify showcase maps read best with ≤ 12 primary nodes')
  }

  const ok = !d.some((x) => x.severity === 'error')
  return { ok, diagnostics: d, ir: ok ? (input as unknown as ArchitectureIR) : undefined }
}
