import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API = (process.env.CREWDESK_API || 'http://127.0.0.1:8010').replace('//localhost', '//127.0.0.1')
const PORT = Number(process.env.CREWDESK_WEB_PORT || 5173)

export default defineConfig({
  plugins: [react()],
  server: {
    port: PORT,
    host: true,
    proxy: { '/api': API },
    warmup: { clientFiles: ['./src/main.jsx', './src/App.jsx', './src/pages/*.jsx', './src/components/*.jsx'] },
  },
  // `npm run preview` serves the optimised production build with the same /api proxy
  preview: { port: PORT, host: true, proxy: { '/api': API } },
  build: { chunkSizeWarningLimit: 1200 },
})
