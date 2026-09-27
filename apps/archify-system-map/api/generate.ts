// Vercel serverless function (Node runtime, web-standard handler).
// Reuses the same logic as the Vite dev middleware in ../vite.config.ts.
// Non-POST methods get an automatic 405 because only POST is exported.
import type { GenerateRequest } from '../shared/api.js'
import { generateArchitecture } from '../server/generate.js'

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as GenerateRequest
    const payload = await generateArchitecture(body)
    return Response.json(payload, { status: payload.ok || payload.ir ? 200 : 400 })
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : 'Generate failed' }, { status: 502 })
  }
}
