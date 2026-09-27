// Optional "generate / refine" path: asks Claude to emit Archify architecture IR
// through a forced tool call, then validates it with the same checks the studio
// uses. Without ANTHROPIC_API_KEY the studio stays on local sample IR.
import Anthropic from '@anthropic-ai/sdk'
import { COMPONENT_TYPES, VARIANTS, CARD_DOTS, SIDES, validateArchitecture } from '../shared/archify.js'
import type { GenerateRequest, GenerateResponse, StatusResponse } from '../shared/api.js'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'

export function getStatus(): StatusResponse {
  return process.env.ANTHROPIC_API_KEY ? { mode: 'claude', model: MODEL } : { mode: 'samples', model: null }
}

const SYSTEM = `You author Archify architecture diagrams as typed JSON IR (schema_version 1, diagram_type "architecture").
Rules (from the Archify authoring contract):
- One obvious main path left→right; short side branches leave the nearest main-path node. At most 12 components.
- Stable lowercase ids (^[a-zA-Z][a-zA-Z0-9_-]*$), short labels (≤ 18 chars), sublabels are a port, tech or role.
- Omit pos/size/row/col: the viewer lays components out automatically from the connection graph.
- Sparse edge labels (≤ 16 chars). Use variant "emphasis" for the main path, "security" for auth/policy, "dashed" for async.
- Boundaries only for real regions/VPCs ("region") or security groups ("security-group").
- 2–3 guided views in meta.views, each focusing the components of one story beat with a one-sentence note.
- 3 short cards summarizing the design. Never invent a subtitle.
Call emit_architecture exactly once.`

const id = { type: 'string', pattern: '^[a-zA-Z][a-zA-Z0-9_-]*$' }
const TOOL: Anthropic.Tool = {
  name: 'emit_architecture',
  description: 'Emit one Archify architecture IR document.',
  input_schema: {
    type: 'object',
    required: ['meta', 'components', 'connections'],
    properties: {
      meta: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string' },
          views: {
            type: 'array',
            maxItems: 5,
            items: {
              type: 'object',
              required: ['id', 'label', 'focus'],
              properties: { id, label: { type: 'string' }, focus: { type: 'array', items: id }, note: { type: 'string' } },
            },
          },
        },
      },
      components: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'type', 'label'],
          properties: {
            id,
            type: { enum: [...COMPONENT_TYPES] },
            label: { type: 'string' },
            sublabel: { type: 'string' },
            tag: { type: 'string' },
          },
        },
      },
      boundaries: {
        type: 'array',
        items: {
          type: 'object',
          required: ['kind', 'label', 'wraps'],
          properties: { kind: { enum: ['region', 'security-group'] }, label: { type: 'string' }, wraps: { type: 'array', items: id } },
        },
      },
      connections: {
        type: 'array',
        items: {
          type: 'object',
          required: ['from', 'to'],
          properties: {
            from: id,
            to: id,
            label: { type: 'string' },
            variant: { enum: [...VARIANTS] },
            fromSide: { enum: [...SIDES] },
            toSide: { enum: [...SIDES] },
          },
        },
      },
      cards: {
        type: 'array',
        items: {
          type: 'object',
          required: ['dot', 'title', 'items'],
          properties: { dot: { enum: [...CARD_DOTS] }, title: { type: 'string' }, items: { type: 'array', items: { type: 'string' } } },
        },
      },
    },
  },
}

function createClient(): Anthropic {
  // Multi-workspace keys need the anthropic-workspace-id header on every request.
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim()
  return new Anthropic(workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : undefined)
}

export async function generateArchitecture({ description, current }: GenerateRequest): Promise<GenerateResponse> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: 'ANTHROPIC_API_KEY is not set on the server; staying on sample IR.' }
  }
  const text = description.trim().slice(0, 4000)
  if (!text) return { ok: false, error: 'Describe the system first.' }
  const prompt = current
    ? `Refine this Archify IR according to the request. Keep ids stable where the component is unchanged.\n\nRequest:\n${text}\n\nCurrent IR:\n${JSON.stringify(current)}`
    : `Draw the architecture of this system:\n\n${text}`

  const response = await createClient().messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: 'tool', name: TOOL.name },
    messages: [{ role: 'user', content: prompt }],
  })
  const use = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
  if (!use) return { ok: false, error: 'The model did not return IR.' }

  const draft = use.input as Record<string, unknown>
  // Positions are left to the viewer's auto layout; strip any the model added.
  if (Array.isArray(draft.components)) {
    for (const c of draft.components as Record<string, unknown>[]) {
      delete c.pos
      delete c.size
      delete c.row
      delete c.col
    }
  }
  const ir = { schema_version: 1, diagram_type: 'architecture', ...draft, meta: { quality_profile: 'showcase', ...(draft.meta as object) } }
  const result = validateArchitecture(ir)
  return { ok: result.ok, ir, diagnostics: result.diagnostics, model: MODEL, error: result.ok ? undefined : 'Generated IR failed validation' }
}
