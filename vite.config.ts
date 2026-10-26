import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// CricDesk uses the same API as Girish Creations (portfolio-server):
// locally through this proxy, on Vercel through the rewrite in vercel.json.
// Port 5174 so it can run next to portfolio-client (5173).
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Only imported by lazily-loaded routes; pre-bundle them so Vite doesn't
    // re-optimise mid-session ("504 Outdated Optimize Dep").
    include: ['sweetalert2', 'react-select', 'react-select/creatable', 'qrcode', 'qr-scanner'],
  },
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
  preview: {
    port: 4174,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
