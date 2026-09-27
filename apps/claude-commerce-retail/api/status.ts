// Vercel serverless function (Node runtime, web-standard handler).
import { getStatus } from '../server/agent.js'

export function GET(): Response {
  return Response.json(getStatus())
}
