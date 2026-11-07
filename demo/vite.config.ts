import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Demo 完全静态：无后端、无外部资产请求。base 用相对路径，便于静态托管与 preview。
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5180, strictPort: false },
  preview: { host: '127.0.0.1', port: 5180, strictPort: false },
  build: { target: 'es2022', chunkSizeWarningLimit: 1600 },
})
