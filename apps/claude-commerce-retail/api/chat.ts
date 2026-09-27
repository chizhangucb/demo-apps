// Vercel serverless function (Node runtime, web-standard handler).
// Reuses the same logic as the Vite dev middleware in ../vite.config.ts.
import { chat } from '../server/agent.js'
import type { ChatRequest } from '../shared/types.js'

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as ChatRequest
    return Response.json(await chat({ messages: body.messages ?? [], cart: body.cart ?? [] }))
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Chat failed' }, { status: 502 })
  }
}
