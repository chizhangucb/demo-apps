import { askGate } from '@/server/jev'
import type { GateRequest } from '@/lib/types'

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as GateRequest
    if (!['model', 'tool', 'done'].includes(body?.gate)) {
      return Response.json({ error: 'Unknown gate' }, { status: 400 })
    }
    return Response.json(await askGate(body))
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Jev gate failed' }, { status: 502 })
  }
}
