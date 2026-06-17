import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    target: 'es2022'
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022'
    }
  },
  server: {
    port: 3094,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:5094',
        changeOrigin: true
      },
      '/download': {
        target: 'http://localhost:5094',
        changeOrigin: true
      }
    }
  }
})
