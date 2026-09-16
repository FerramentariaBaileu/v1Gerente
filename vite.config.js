import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { apiMiddleware } from './server/apiMiddleware.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const name of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'GEMINI_API_KEY', 'GEMINI_MODEL']) {
    if (env[name]) process.env[name] = env[name]
  }
  return { plugins: [react(), {
    name: 'gerente-api-local',
    configureServer(server) { server.middlewares.use(apiMiddleware) },
    configurePreviewServer(server) { server.middlewares.use(apiMiddleware) }
  }], server: { host: '127.0.0.1' }, preview: { host: '127.0.0.1' } }
})
