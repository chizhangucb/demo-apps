import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Connect, type Plugin } from 'vite'
import { getStatus, triageMessages } from './server/triage.ts'

function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

/** Serves /api/* from the dev server so the TypeSafe API key never reaches the browser. */
function triageApi(): Plugin {
  return {
    name: 'triage-api',
    configureServer(server) {
      server.middlewares.use('/api/status', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(getStatus()))
      })
      server.middlewares.use('/api/triage', async (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Use POST' }))
          return
        }
        try {
          const { messages } = JSON.parse(await readBody(req)) as {
            messages: string[]
          }
          const payload = await triageMessages(messages)
          res.end(JSON.stringify(payload))
        } catch (err) {
          res.statusCode = 502
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'Triage failed',
            }),
          )
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), triageApi()],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
})
