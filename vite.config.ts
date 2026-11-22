import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// RunMitra's API is ../runmitra-api: locally through this proxy (to
// API_PROXY_TARGET from .env.development), on Vercel through the rewrites in
// vercel.json. Port 5174 so it can run next to portfolio-client (5173).

// This build's version, "1.0.<seconds since 1970>": newer builds count higher.
// An open tab (src/app-shell/webUpdate.ts) and the Android app
// (src/app-shell/liveUpdate.ts, scripts/pack-app-update.mjs) compare it with
// the deployed one to move to a new deploy.
const APP_BUILD = `1.0.${Math.floor(Date.now() / 1000)}`

export default defineConfig(({ mode }) => {
  const apiTarget = loadEnv(mode, process.cwd(), '').API_PROXY_TARGET || 'http://localhost:4000'
  const proxy = { '/api': { target: apiTarget, changeOrigin: true } }
  return {
    define: {
      __APP_BUILD__: JSON.stringify(APP_BUILD),
    },
    plugins: [
      react(),
      {
        // dist/app-version.json: the deployed build's version.
        name: 'runmitra-app-version',
        apply: 'build',
        generateBundle() {
          this.emitFile({ type: 'asset', fileName: 'app-version.json', source: JSON.stringify({ version: APP_BUILD }) })
        },
      },
    ],
    optimizeDeps: {
      // Only imported by lazily-loaded routes; pre-bundle them so Vite doesn't
      // re-optimise mid-session ("504 Outdated Optimize Dep").
      include: ['sweetalert2', 'react-select', 'react-select/creatable', 'qrcode', 'qr-scanner'],
    },
    server: { port: 5174, proxy },
    preview: { port: 4174, proxy },
  }
})
