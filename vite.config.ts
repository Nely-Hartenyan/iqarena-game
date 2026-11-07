import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { arenaPlugin } from './vite-arena.ts'

export default defineConfig({
  plugins: [react(), arenaPlugin()],
  server: { port: 5182, strictPort: true, host: true },
  preview: { port: 5182, strictPort: true, host: true },
})
