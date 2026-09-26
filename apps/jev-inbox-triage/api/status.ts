// Vercel serverless function (Node runtime, web-standard handler).
// Reuses the same logic as the Vite dev middleware in ../vite.config.ts.
import { getStatus } from '../server/triage.js'

export function GET(): Response {
  return Response.json(getStatus())
}
