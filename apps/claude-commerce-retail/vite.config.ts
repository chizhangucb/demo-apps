import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import { chat, getStatus } from './server/agent.js'
import type { ChatRequest } from './shared/types.js'

function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

/** Serves /api/* from the dev server so ANTHROPIC_API_KEY never reaches the browser. */
function shopApi(): Plugin {
  return {
    name: 'shop-api',
    configureServer(server) {
      server.middlewares.use('/api/status', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(getStatus()))
      })
      server.middlewares.use('/api/chat', async (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Use POST' }))
          return
        }
        try {
          const body = JSON.parse(await readBody(req)) as ChatRequest
          res.end(JSON.stringify(await chat({ messages: body.messages ?? [], cart: body.cart ?? [] })))
        } catch (err) {
          res.statusCode = 502
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Chat failed' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // `bun run dev` spawns Vite without injecting `.env`, so load the server-only
  // keys here. Empty prefix on purpose: these must NOT be VITE_-prefixed,
  // which also keeps them out of the client bundle. Shell exports win.
  const fileEnv = loadEnv(mode, new URL('.', import.meta.url).pathname, '')
  for (const key of ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL']) {
    if (!process.env[key] && fileEnv[key]) process.env[key] = fileEnv[key]
  }

  return {
    plugins: [react(), tailwindcss(), shopApi()],
    resolve: {
      alias: { '@': new URL('./src', import.meta.url).pathname },
    },
  }
})
