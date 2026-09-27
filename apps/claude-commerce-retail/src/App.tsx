import { useEffect, useRef, useState } from 'react'
import { Bot, Loader2, Minus, Plus, SendHorizontal, ShoppingBag, Sparkles, Trash2, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import catalogJson from '../data/catalog.json'
import type {
  CartLine,
  CartSuggestion,
  ChatResponse,
  ChatTurn,
  Product,
  StatusResponse,
  ToolCall,
} from '../shared/types'

const catalog = catalogJson as unknown as Product[]
const bySku = new Map(catalog.map((p) => [p.sku, p]))

const STARTERS = [
  'Gift ideas under $50',
  'In-stock sneakers in size 10',
  "What's your return policy?",
  'Build me a rainy-day travel bundle',
]

interface Entry {
  role: 'user' | 'assistant'
  text: string
  reply?: ChatResponse
  error?: boolean
}

const TOOL_STYLE: Record<ToolCall['name'], string> = {
  browse: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  policy: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  inventory: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  cart_suggest: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200',
}

function formatInput(input: Record<string, unknown>): string {
  return Object.entries(input)
    .filter(([k]) => k !== 'items')
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(' ')
}

function ToolChip({ call }: { call: ToolCall }) {
  const args = formatInput(call.input)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] ${TOOL_STYLE[call.name]}`}
      title={JSON.stringify(call.input)}
    >
      <Wrench className="size-3" />
      <span className="font-semibold">{call.name}</span>
      {args && <span className="max-w-48 truncate opacity-70">{args}</span>}
      <span className="opacity-70">→ {call.summary}</span>
    </span>
  )
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: (sku: string, size: string) => void }) {
  const sizes = Object.entries(product.stock)
  const firstInStock = sizes.find(([, n]) => n > 0)?.[0]
  const [size, setSize] = useState(firstInStock ?? sizes[0][0])
  const soldOut = !firstInStock
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-3">
      <div className="flex h-20 items-center justify-center rounded-lg bg-gradient-to-br from-muted to-muted/40 text-4xl">
        {product.emoji}
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm leading-tight font-medium">{product.name}</div>
        <div className="text-sm font-semibold">${product.price}</div>
      </div>
      <div className="line-clamp-2 text-xs text-muted-foreground">{product.description}</div>
      <div className="flex flex-wrap gap-1">
        {sizes.length > 1 || sizes[0][0] !== 'one-size'
          ? sizes.map(([s, n]) => (
              <button
                key={s}
                disabled={n === 0}
                onClick={() => setSize(s)}
                className={`rounded-md border px-1.5 py-0.5 text-[11px] disabled:line-through disabled:opacity-40 ${
                  size === s ? 'border-foreground bg-foreground text-background' : ''
                }`}
              >
                {s}
              </button>
            ))
          : null}
      </div>
      <Button size="sm" variant={soldOut ? 'outline' : 'default'} disabled={soldOut} onClick={() => onAdd(product.sku, size)}>
        {soldOut ? 'Sold out' : 'Add to cart'}
      </Button>
    </div>
  )
}

function SuggestionRow({ s, onAdd, inCart }: { s: CartSuggestion; onAdd: () => void; inCart: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-violet-300 bg-violet-50/60 px-3 py-2 dark:border-violet-800 dark:bg-violet-950/30">
      <span className="text-xl">{s.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {s.name} <span className="text-muted-foreground">· {s.size === 'one-size' ? 'one size' : `size ${s.size}`}</span>
        </div>
        <div className="truncate text-xs text-muted-foreground">{s.reason}</div>
      </div>
      <Button size="sm" variant={inCart ? 'outline' : 'default'} onClick={onAdd}>
        {inCart ? 'Add another' : `Add · $${s.price}`}
      </Button>
    </div>
  )
}

export default function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [cart, setCart] = useState<CartLine[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ mode: 'mock', model: null }))
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [entries, busy])

  function addToCart(sku: string, size: string, qty = 1) {
    setCart((c) => {
      const i = c.findIndex((l) => l.sku === sku && l.size === size)
      if (i === -1) return [...c, { sku, size, qty }]
      return c.map((l, j) => (j === i ? { ...l, qty: l.qty + qty } : l))
    })
  }

  function bump(i: number, delta: number) {
    setCart((c) => c.map((l, j) => (j === i ? { ...l, qty: l.qty + delta } : l)).filter((l) => l.qty > 0))
  }

  async function send(text: string) {
    const content = text.trim()
    if (!content || busy) return
    const next: Entry[] = [...entries, { role: 'user', text: content }]
    setEntries(next)
    setDraft('')
    setBusy(true)
    const messages: ChatTurn[] = next.filter((e) => !e.error).map((e) => ({ role: e.role, content: e.text }))
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, cart }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      const reply = data as ChatResponse
      setEntries((e) => [...e, { role: 'assistant', text: reply.text, reply }])
    } catch (err) {
      setEntries((e) => [
        ...e,
        { role: 'assistant', text: err instanceof Error ? err.message : 'Something went wrong', error: true },
      ])
    } finally {
      setBusy(false)
    }
  }

  const subtotal = cart.reduce((sum, l) => sum + (bySku.get(l.sku)?.price ?? 0) * l.qty, 0)
  const count = cart.reduce((n, l) => n + l.qty, 0)

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <ShoppingBag className="size-5" />
          <span className="font-semibold tracking-tight">Northwind Goods</span>
          <span className="hidden text-sm text-muted-foreground sm:inline">· shopping agent demo</span>
        </div>
        <div className="flex items-center gap-2">
          {status && (
            <Badge variant={status.mode === 'claude' ? 'default' : 'secondary'}>
              {status.mode === 'claude' ? `Claude · ${status.model}` : 'Mock mode · no API key'}
            </Badge>
          )}
          <Badge variant="outline" className="lg:hidden">
            🛒 {count}
          </Badge>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
              {entries.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                    <Sparkles className="size-6" />
                  </div>
                  <h1 className="text-2xl font-semibold tracking-tight">What are you shopping for?</h1>
                  <p className="max-w-md text-sm text-muted-foreground">
                    Ask in plain language. The agent browses a {catalog.length}-item mock catalog, checks stock and store
                    policy, and suggests items for your cart. Nothing is ever charged.
                  </p>
                </div>
              )}

              {entries.map((e, i) =>
                e.role === 'user' ? (
                  <div key={i} className="self-end rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
                    {e.text}
                  </div>
                ) : (
                  <div key={i} className="flex gap-3">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Bot className="size-4" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                      {e.reply && e.reply.toolCalls.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {e.reply.toolCalls.map((c, j) => (
                            <ToolChip key={j} call={c} />
                          ))}
                        </div>
                      )}
                      <div className={`text-sm leading-relaxed whitespace-pre-wrap ${e.error ? 'text-destructive' : ''}`}>
                        {e.text}
                      </div>
                      {e.reply && e.reply.products.length > 0 && (
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                          {e.reply.products.map((p) => (
                            <ProductCard key={p.sku} product={p} onAdd={addToCart} />
                          ))}
                        </div>
                      )}
                      {e.reply && e.reply.suggestions.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            Suggested for your cart
                          </div>
                          {e.reply.suggestions.map((s) => (
                            <SuggestionRow
                              key={`${s.sku}:${s.size}`}
                              s={s}
                              inCart={cart.some((l) => l.sku === s.sku && l.size === s.size)}
                              onAdd={() => addToCart(s.sku, s.size, s.qty)}
                            />
                          ))}
                          {e.reply.suggestions.length > 1 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="self-start"
                              onClick={() => e.reply!.suggestions.forEach((s) => addToCart(s.sku, s.size, s.qty))}
                            >
                              Add all {e.reply.suggestions.length}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ),
              )}

              {busy && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Agent is shopping…
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>

          <div className="border-t bg-background px-4 py-3 sm:px-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    disabled={busy}
                    onClick={() => send(s)}
                    className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(ev) => {
                  ev.preventDefault()
                  send(draft)
                }}
              >
                <Input
                  value={draft}
                  onChange={(ev) => setDraft(ev.target.value)}
                  placeholder="e.g. a warm gift for my dad under $80"
                  disabled={busy}
                  aria-label="Message the shopping agent"
                />
                <Button type="submit" disabled={busy || !draft.trim()} aria-label="Send">
                  <SendHorizontal />
                </Button>
              </form>
            </div>
          </div>
        </main>

        <aside className="hidden w-80 shrink-0 border-l bg-muted/30 p-4 lg:block">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Your cart</span>
                <Badge variant="secondary">{count} items</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {cart.length === 0 && (
                <p className="text-sm text-muted-foreground">Empty. Ask the agent for ideas, then tap "Add".</p>
              )}
              {cart.map((l, i) => {
                const p = bySku.get(l.sku)
                if (!p) return null
                return (
                  <div key={`${l.sku}:${l.size}`} className="flex items-center gap-2">
                    <span className="text-xl">{p.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.size === 'one-size' ? 'One size' : `Size ${l.size}`} · ${p.price}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon-xs" variant="ghost" onClick={() => bump(i, -1)} aria-label="Decrease">
                        {l.qty === 1 ? <Trash2 /> : <Minus />}
                      </Button>
                      <span className="w-4 text-center text-sm tabular-nums">{l.qty}</span>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => bump(i, 1)}
                        disabled={l.qty >= (p.stock[l.size] ?? 0)}
                        aria-label="Increase"
                      >
                        <Plus />
                      </Button>
                    </div>
                  </div>
                )
              })}
              <Separator />
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span className="font-semibold tabular-nums">${subtotal.toFixed(2)}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {subtotal >= 75 ? 'Free standard shipping unlocked.' : `$${(75 - subtotal).toFixed(2)} away from free shipping.`}
              </div>
              <Button disabled title="Demo only — no real checkout">
                Checkout (demo only)
              </Button>
            </CardContent>
          </Card>
          <p className="mt-4 text-xs text-muted-foreground">
            Inspired by the Apache-2.0{' '}
            <a className="underline" href="https://github.com/anthropics/commerce-agents" target="_blank" rel="noreferrer">
              anthropics/commerce-agents
            </a>{' '}
            retail blueprint. Mock catalog, no real payments.
          </p>
        </aside>
      </div>
    </div>
  )
}
