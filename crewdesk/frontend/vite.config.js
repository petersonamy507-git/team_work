import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API = process.env.CREWDESK_API || 'http://localhost:8000'
const PORT = Number(process.env.CREWDESK_WEB_PORT || 5173)

export default defineConfig({
  plugins: [react()],
  server: {
    port: PORT,
    proxy: { '/api': API },
  },
})
