import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// RunMitra's API is ../runmitra-api: locally through this proxy (to
// API_PROXY_TARGET from .env.development), on Vercel through the rewrites in
// vercel.json. Port 5174 so it can run next to portfolio-client (5173).
export default defineConfig(({ mode }) => {
  const apiTarget = loadEnv(mode, process.cwd(), '').API_PROXY_TARGET || 'http://localhost:4000'
  const proxy = { '/api': { target: apiTarget, changeOrigin: true } }
  return {
    plugins: [react()],
    optimizeDeps: {
      // Only imported by lazily-loaded routes; pre-bundle them so Vite doesn't
      // re-optimise mid-session ("504 Outdated Optimize Dep").
      include: ['sweetalert2', 'react-select', 'react-select/creatable', 'qrcode', 'qr-scanner'],
    },
    server: { port: 5174, proxy },
    preview: { port: 4174, proxy },
  }
})
