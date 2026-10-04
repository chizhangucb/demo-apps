import { getStatus } from '@/server/jev'

export const dynamic = 'force-dynamic'

export function GET(): Response {
  return Response.json(getStatus())
}
