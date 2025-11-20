import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    vue()
  ],
  // 我们移除了所有 alias 配置
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      '/sub': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      }
    }
  }
})