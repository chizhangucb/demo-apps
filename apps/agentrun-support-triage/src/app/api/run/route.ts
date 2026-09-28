import { runTriage } from '@/server/runner'
import type { RunError } from '@/lib/types'

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { ticketId?: string; ticket?: string; live?: boolean }
    return Response.json(await runTriage({ ticketId: body.ticketId, ticket: body.ticket ?? '', live: Boolean(body.live) }))
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Workflow run failed'
    return Response.json({ ok: false, error } satisfies RunError, { status: 502 })
  }
}
