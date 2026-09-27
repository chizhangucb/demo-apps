// `bun run validate` — checks every checked-in sample IR and renders it once.
import { readdirSync, readFileSync } from 'node:fs'
import { validateArchitecture } from '../shared/archify.js'
import { renderArchitectureHtml } from '../shared/render.js'

const dir = new URL('../data/', import.meta.url)
let failed = 0
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const result = validateArchitecture(JSON.parse(readFileSync(new URL(file, dir), 'utf8')))
  const html = result.ir ? renderArchitectureHtml(result.ir) : ''
  const errors = result.diagnostics.filter((d) => d.severity === 'error')
  console.log(`${result.ok ? '✓' : '✗'} ${file} — ${errors.length} errors, ${result.diagnostics.length - errors.length} warnings, ${html.length} bytes HTML`)
  for (const d of result.diagnostics) console.log(`    ${d.severity} ${d.path}: ${d.message}`)
  if (!result.ok) failed++
}
process.exit(failed ? 1 : 0)
