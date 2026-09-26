// Vercel serverless function (Node runtime, web-standard handler).
// Reuses the same logic as the Vite dev middleware in ../vite.config.ts.
// Non-POST methods get an automatic 405 because only POST is exported.
import { triageMessages } from '../server/triage.ts'

export async function POST(request: Request): Promise<Response> {
  try {
    const { messages } = (await request.json()) as { messages: string[] }
    const payload = await triageMessages(messages)
    return Response.json(payload)
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Triage failed' },
      { status: 502 },
    )
  }
}
