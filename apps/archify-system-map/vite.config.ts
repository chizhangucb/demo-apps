import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import { generateArchitecture, getStatus } from './server/generate.js'

function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

/** Serves /api/* from the dev server so the Anthropic key never reaches the browser. */
function generateApi(): Plugin {
  return {
    name: 'archify-generate-api',
    configureServer(server) {
      server.middlewares.use('/api/status', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(getStatus()))
      })
      server.middlewares.use('/api/generate', async (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ ok: false, error: 'Use POST' }))
          return
        }
        try {
          const payload = await generateArchitecture(JSON.parse(await readBody(req)))
          if (!payload.ok && !payload.ir) res.statusCode = 400
          res.end(JSON.stringify(payload))
        } catch (err) {
          res.statusCode = 502
          res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Generate failed' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // `bun run dev` spawns Vite without injecting `.env`, so load the server-only
  // keys here. Empty prefix on purpose: these must NOT be VITE_-prefixed.
  const fileEnv = loadEnv(mode, new URL('.', import.meta.url).pathname, '')
  for (const key of ['ANTHROPIC_API_KEY', 'ANTHROPIC_WORKSPACE_ID', 'ANTHROPIC_MODEL']) {
    if (!process.env[key] && fileEnv[key]) process.env[key] = fileEnv[key]
  }

  return {
    plugins: [react(), tailwindcss(), generateApi()],
    resolve: {
      alias: {
        '@': new URL('./src', import.meta.url).pathname,
        '@shared': new URL('./shared', import.meta.url).pathname,
      },
    },
  }
})
