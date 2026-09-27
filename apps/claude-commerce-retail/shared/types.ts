export interface Product {
  sku: string
  name: string
  category: string
  price: number
  emoji: string
  tags: string[]
  description: string
  /** Units on hand per size ("one-size" for unsized items). */
  stock: Record<string, number>
}

export interface CartLine {
  sku: string
  size: string
  qty: number
}

export interface CartSuggestion extends CartLine {
  name: string
  price: number
  emoji: string
  reason: string
}

export type ToolName = 'browse' | 'policy' | 'inventory' | 'cart_suggest'

export interface ToolCall {
  name: ToolName
  input: Record<string, unknown>
  /** One-line human summary of what the tool returned. */
  summary: string
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  messages: ChatTurn[]
  cart: CartLine[]
}

export interface ChatResponse {
  mode: 'claude' | 'mock'
  text: string
  toolCalls: ToolCall[]
  products: Product[]
  suggestions: CartSuggestion[]
}

export interface StatusResponse {
  mode: 'claude' | 'mock'
  model: string | null
}
