import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
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
