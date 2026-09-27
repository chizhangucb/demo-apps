// Shopping agent: a manual Claude tool-use loop over the mock tools in
// ./tools.ts. Without ANTHROPIC_API_KEY it falls back to a canned,
// keyword-routed flow that calls the very same tools, so the UI still demos.
import Anthropic from '@anthropic-ai/sdk'
import type {
  CartLine,
  CartSuggestion,
  ChatRequest,
  ChatResponse,
  Product,
  StatusResponse,
  ToolCall,
  ToolName,
} from '../shared/types.js'
import { browse, runTool, toolDefs, totalStock } from './tools.js'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'
const EFFORT = (process.env.ANTHROPIC_EFFORT as 'low' | 'medium' | 'high' | undefined) || 'medium'
const MAX_TOOL_ROUNDS = 6

const SYSTEM = `You are the shopping assistant for "Northwind Goods", a small online retail store.
Help one shopper find products, answer policy questions, and build a cart.

- Use the browse tool to find products; never invent SKUs, prices, or stock.
- Use the inventory tool when the shopper asks about a size or availability.
- Use the policy tool for returns, shipping, warranty, gifts, or price matching; quote it faithfully.
- When you recommend specific items, call cart_suggest so the shopper gets one-click "Add" buttons. Sized items need a size; ask if unknown.
- Nothing is purchased here: there is no checkout. Never claim to have placed an order.
- Keep replies short and friendly (2–4 sentences). Product cards and cart buttons are shown by the UI, so don't repeat every detail.`

export function getStatus(): StatusResponse {
  return process.env.ANTHROPIC_API_KEY
    ? { mode: 'claude', model: MODEL, effort: EFFORT }
    : { mode: 'mock', model: null, effort: null }
}

function describeCart(cart: CartLine[]): string {
  if (!cart.length) return 'Shopper cart: empty.'
  return `Shopper cart: ${cart.map((l) => `${l.qty}× ${l.sku} (size ${l.size})`).join(', ')}.`
}

function dedupe<T>(items: T[], key: (t: T) => string): T[] {
  const seen = new Map<string, T>()
  for (const i of items) seen.set(key(i), i)
  return [...seen.values()]
}

export async function chat(req: ChatRequest): Promise<ChatResponse> {
  return process.env.ANTHROPIC_API_KEY ? chatWithClaude(req) : chatMock(req)
}

function createClient(): Anthropic {
  // Multi-workspace / identity-linked keys require anthropic-workspace-id on every
  // request. Workspace-scoped keys can omit it. See Anthropic auth docs.
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim()
  return new Anthropic(
    workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : undefined,
  )
}

function rethrowClaudeError(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err)
  if (/workspace-id|not scoped to a workspace|identity-linked API key/i.test(msg)) {
    throw new Error(
      'Anthropic rejected the request: this API key is not scoped to a workspace. ' +
        'Set ANTHROPIC_WORKSPACE_ID (Claude Console → Settings → Workspaces) on the server, ' +
        'or create a workspace-scoped API key at console.anthropic.com/settings/keys.',
    )
  }
  throw err instanceof Error ? err : new Error(msg)
}

async function chatWithClaude({ messages, cart }: ChatRequest): Promise<ChatResponse> {
  const client = createClient()
  const history: Anthropic.Beta.BetaMessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }))
  // Cart state rides along on the latest user turn so the system prompt stays cacheable.
  const last = history[history.length - 1]
  if (last?.role === 'user' && typeof last.content === 'string') {
    last.content = `${last.content}\n\n<context>${describeCart(cart)}</context>`
  }

  const toolCalls: ToolCall[] = []
  let products: Product[] = []
  let suggestions: CartSuggestion[] = []

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        tools: toolDefs,
        thinking: { type: 'adaptive' },
        output_config: { effort: EFFORT },
        // Server-side refusal fallback, routed by refusal category.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        messages: history,
      })

      if (response.stop_reason === 'refusal') {
        return { mode: 'claude', text: "Sorry, I can't help with that one.", toolCalls, products, suggestions }
      }

      const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
      if (response.stop_reason !== 'tool_use' || toolUses.length === 0 || round === MAX_TOOL_ROUNDS) {
        const text = response.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim()
        return {
          mode: 'claude',
          text: text || 'Here is what I found.',
          toolCalls,
          products: dedupe(products, (p) => p.sku),
          suggestions: dedupe(suggestions, (s) => `${s.sku}:${s.size}`),
        }
      }

      history.push({ role: 'assistant', content: response.content })
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((use) => {
        const input = (use.input ?? {}) as Record<string, unknown>
        try {
          const run = runTool(use.name as ToolName, input)
          toolCalls.push({ name: use.name as ToolName, input, summary: run.summary })
          products = products.concat(run.products)
          suggestions = suggestions.concat(run.suggestions)
          return { type: 'tool_result', tool_use_id: use.id, content: JSON.stringify(run.result) }
        } catch (err) {
          return {
            type: 'tool_result',
            tool_use_id: use.id,
            is_error: true,
            content: err instanceof Error ? err.message : 'Tool failed',
          }
        }
      })
      // All tool results go back in a single user message.
      history.push({ role: 'user', content: results })
    }
    throw new Error('unreachable')
  } catch (err) {
    rethrowClaudeError(err)
  }
}

// ---------------------------------------------------------------------------
// Degraded mode: deterministic keyword routing over the same tools.

function call(name: ToolName, input: Record<string, unknown>, acc: ToolCall[]) {
  const run = runTool(name, input)
  acc.push({ name, input, summary: run.summary })
  return run
}

function chatMock({ messages }: ChatRequest): ChatResponse {
  const q = (messages.filter((m) => m.role === 'user').at(-1)?.content ?? '').toLowerCase()
  const toolCalls: ToolCall[] = []
  const reply = (text: string, products: Product[] = [], suggestions: CartSuggestion[] = []): ChatResponse => ({
    mode: 'mock',
    text,
    toolCalls,
    products,
    suggestions,
  })

  const topic = q.match(/return|refund|exchange|ship|deliver|warranty|defect|gift wrap|receipt|price match/)?.[0]
  if (topic) {
    const r = call('policy', { topic }, toolCalls).result as { text: string }
    return reply(r.text)
  }

  const price = q.match(/(?:under|below|less than|<)\s*\$?(\d+)/)
  const size = q.match(/size\s*([0-9]+|xs|s|m|l|xl)\b/)?.[1]?.toUpperCase()
  const category = (['sneakers', 'apparel', 'accessories', 'home'] as const).find((c) =>
    q.includes(c.replace(/s$/, '')),
  ) ?? (/shoe|sneaker/.test(q) ? 'sneakers' : undefined)
  const skuMatch = q.match(/\b([a-z]{3}-\d{3})\b/)?.[1]

  if (skuMatch && /stock|available|left/.test(q)) {
    const run = call('inventory', { sku: skuMatch, ...(size && { size }) }, toolCalls)
    const r = run.result as { found: boolean; available?: boolean }
    return reply(
      r.found ? `Checked stock: ${run.summary}.${r.available ? '' : ' Want me to suggest an in-stock alternative?'}` : `I couldn't find ${skuMatch.toUpperCase()}.`,
      browse({ sku: skuMatch }),
    )
  }

  const input: Record<string, unknown> = {}
  if (price) input.max_price = Number(price[1])
  if (category) input.category = category
  if (size) input.size = size
  if (/in[- ]stock|available/.test(q)) input.in_stock_only = true
  if (!category || /gift/.test(q)) input.query = q

  let products = call('browse', input, toolCalls).products
  if (!products.length && input.query) {
    delete input.query
    products = call('browse', input, toolCalls).products
  }
  if (!products.length) {
    return reply("I couldn't find a match. Try a category like sneakers, apparel, accessories or home.")
  }

  const picks = products.filter((p) => totalStock(p) > 0).slice(0, /bundle|set|kit/.test(q) ? 3 : 2)
  for (const p of picks) {
    const sizeToCheck = size ?? Object.entries(p.stock).find(([, n]) => n > 0)?.[0]
    if (sizeToCheck) call('inventory', { sku: p.sku, size: sizeToCheck }, toolCalls)
  }
  const suggestions = call(
    'cart_suggest',
    {
      items: picks.map((p) => ({
        sku: p.sku,
        size: size ?? Object.entries(p.stock).find(([, n]) => n > 0)?.[0],
        reason: `$${p.price} · ${p.tags.slice(0, 2).join(', ')}`,
      })),
    },
    toolCalls,
  ).suggestions

  const lead = price ? `Here are picks under $${price[1]}` : size ? `In stock in size ${size}` : 'Here is what I found'
  return reply(
    `${lead}: ${picks.map((p) => `${p.name} ($${p.price})`).join(', ').replace(/, ([^,]*)$/, ' and $1')}. Tap "Add" to put one in your cart. (Mock mode: set ANTHROPIC_API_KEY for the live Claude agent.)`,
    products,
    suggestions,
  )
}
