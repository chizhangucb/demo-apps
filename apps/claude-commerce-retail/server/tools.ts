// Mock commerce backends. Pure local functions over JSON files — the
// "browse / policy / inventory / cart-suggest" tool patterns from the
// anthropics/commerce-agents retail blueprint, thin-sliced.
import type Anthropic from '@anthropic-ai/sdk'
import catalogJson from '../data/catalog.json' with { type: 'json' }
import policiesJson from '../data/policies.json' with { type: 'json' }
import type { CartSuggestion, Product, ToolName } from '../shared/types.js'

export const catalog = catalogJson as unknown as Product[]
export const policies = policiesJson as Record<string, string>

const bySku = new Map(catalog.map((p) => [p.sku, p]))

export function totalStock(p: Product): number {
  return Object.values(p.stock).reduce((a, b) => a + b, 0)
}

export interface BrowseInput {
  query?: string
  category?: string
  max_price?: number
  size?: string
  in_stock_only?: boolean
  sku?: string
}

export function browse(input: BrowseInput): Product[] {
  if (input.sku) {
    const p = bySku.get(input.sku.toUpperCase())
    return p ? [p] : []
  }
  const words = (input.query ?? '')
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2)
  return catalog
    .filter((p) => !input.category || p.category === input.category.toLowerCase())
    .filter((p) => input.max_price == null || p.price <= input.max_price)
    .filter((p) => {
      if (!input.in_stock_only && !input.size) return true
      if (input.size) return (p.stock[input.size] ?? 0) > 0
      return totalStock(p) > 0
    })
    .map((p) => {
      const hay = `${p.name} ${p.category} ${p.tags.join(' ')} ${p.description}`.toLowerCase().split(/\W+/)
      // Prefix match on whole words so "rainy" hits "rain" and "sneakers" hits "sneaker".
      const hit = (w: string) => hay.some((h) => h.length > 2 && (h.startsWith(w) || (h.length > 3 && w.startsWith(h))))
      const score = words.filter(hit).length
      return { p, score }
    })
    .filter(({ score }) => words.length === 0 || score > 0)
    .sort((a, b) => b.score - a.score || a.p.price - b.p.price)
    .slice(0, 6)
    .map(({ p }) => p)
}

export function policy(input: { topic: string }): { topic: string; text: string } {
  const t = input.topic.toLowerCase()
  const key =
    Object.keys(policies).find((k) => t.includes(k.replace('_', ' ')) || t.includes(k)) ??
    (/(refund|return)/.test(t)
      ? 'returns'
      : /(ship|deliver)/.test(t)
        ? 'shipping'
        : /(defect|broke|guarantee)/.test(t)
          ? 'warranty'
          : /(wrap|receipt)/.test(t)
            ? 'gift'
            : null)
  return key
    ? { topic: key, text: policies[key] }
    : { topic: 'unknown', text: `No policy found. Known topics: ${Object.keys(policies).join(', ')}.` }
}

export function inventory(input: { sku: string; size?: string }) {
  const p = bySku.get(input.sku.toUpperCase())
  if (!p) return { sku: input.sku, found: false as const }
  if (input.size) {
    const units = p.stock[input.size] ?? 0
    return { sku: p.sku, name: p.name, found: true as const, size: input.size, units, available: units > 0 }
  }
  return { sku: p.sku, name: p.name, found: true as const, stock: p.stock, available: totalStock(p) > 0 }
}

export interface CartSuggestInput {
  items: { sku: string; size?: string; qty?: number; reason: string }[]
}

/** Validates proposed cart adds against the catalog and stock; never mutates the cart. */
export function cartSuggest(input: CartSuggestInput): { accepted: CartSuggestion[]; rejected: string[] } {
  const accepted: CartSuggestion[] = []
  const rejected: string[] = []
  for (const item of input.items) {
    const p = bySku.get(item.sku.toUpperCase())
    if (!p) {
      rejected.push(`${item.sku}: unknown SKU`)
      continue
    }
    const sizes = Object.keys(p.stock)
    const size = item.size ?? (sizes.length === 1 ? sizes[0] : '')
    const qty = Math.max(1, item.qty ?? 1)
    if (!size || !(size in p.stock)) {
      rejected.push(`${p.sku}: pick a size (${sizes.join(', ')})`)
    } else if (p.stock[size] < qty) {
      rejected.push(`${p.sku}: only ${p.stock[size]} left in size ${size}`)
    } else {
      accepted.push({ sku: p.sku, size, qty, name: p.name, price: p.price, emoji: p.emoji, reason: item.reason })
    }
  }
  return { accepted, rejected }
}

export const toolDefs: Anthropic.Messages.Tool[] = [
  {
    name: 'browse',
    description:
      'Search the store catalog. Filter by free-text query, category (sneakers, apparel, accessories, home), max_price in USD, size, or in_stock_only. Pass sku to get one product. Returns up to 6 products including per-size stock.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        category: { type: 'string', enum: ['sneakers', 'apparel', 'accessories', 'home'] },
        max_price: { type: 'number' },
        size: { type: 'string', description: 'Shoe size like "10" or apparel size like "M".' },
        in_stock_only: { type: 'boolean' },
        sku: { type: 'string' },
      },
    },
  },
  {
    name: 'policy',
    description:
      'Look up store policy text. Topics: returns, exchanges, shipping, warranty, gift, price_match. Always use this instead of guessing policy.',
    input_schema: {
      type: 'object',
      properties: { topic: { type: 'string' } },
      required: ['topic'],
    },
  },
  {
    name: 'inventory',
    description: 'Check live stock for a SKU, optionally for a single size.',
    input_schema: {
      type: 'object',
      properties: { sku: { type: 'string' }, size: { type: 'string' } },
      required: ['sku'],
    },
  },
  {
    name: 'cart_suggest',
    description:
      'Propose items for the shopper to add to their cart. The shopper sees one-click "Add" buttons; nothing is added without their click. Include a short reason per item. Use for recommendations and bundles.',
    input_schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sku: { type: 'string' },
              size: { type: 'string' },
              qty: { type: 'integer', minimum: 1 },
              reason: { type: 'string' },
            },
            required: ['sku', 'reason'],
          },
        },
      },
      required: ['items'],
    },
  },
]

export interface ToolRun {
  result: unknown
  summary: string
  products: Product[]
  suggestions: CartSuggestion[]
}

export function runTool(name: ToolName, input: Record<string, unknown>): ToolRun {
  switch (name) {
    case 'browse': {
      const products = browse(input as BrowseInput)
      return {
        result: products,
        summary: products.length ? `${products.length} product${products.length > 1 ? 's' : ''} found` : 'no matches',
        products,
        suggestions: [],
      }
    }
    case 'policy': {
      const r = policy(input as { topic: string })
      return { result: r, summary: `policy: ${r.topic}`, products: [], suggestions: [] }
    }
    case 'inventory': {
      const r = inventory(input as { sku: string; size?: string })
      const summary = !r.found
        ? 'unknown SKU'
        : 'units' in r
          ? `${r.sku} size ${r.size}: ${r.units} left`
          : `${r.sku}: ${r.available ? 'in stock' : 'sold out'}`
      return { result: r, summary, products: [], suggestions: [] }
    }
    case 'cart_suggest': {
      const r = cartSuggest(input as unknown as CartSuggestInput)
      return {
        result: r,
        summary: `${r.accepted.length} suggested${r.rejected.length ? `, ${r.rejected.length} rejected` : ''}`,
        products: [],
        suggestions: r.accepted,
      }
    }
  }
}
