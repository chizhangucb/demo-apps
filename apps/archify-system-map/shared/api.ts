import type { ArchitectureIR, Diagnostic } from './archify.js'

export type StatusResponse = { mode: 'claude'; model: string } | { mode: 'samples'; model: null }

export interface GenerateRequest {
  description: string
  current?: ArchitectureIR
}

export interface GenerateResponse {
  ok: boolean
  ir?: unknown
  diagnostics?: Diagnostic[]
  model?: string
  error?: string
}
