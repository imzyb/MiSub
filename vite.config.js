import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'
import manifest from './public/manifest.json' with { type: 'json' }

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        // 使用离线回退页面，并显式忽略订阅路径
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/sub\/.*/,      // /sub/...
          /^\/cdn-cgi\/.*/,  // Cloudflare Web Analytics
          /^\/[^/]+\/[^/]+(\?.*)?$/ // Two-segment paths like /test1/work, optionally with query params
        ],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'page-cache',
              networkTimeoutSeconds: 5,
              cacheableResponse: {
                statuses: [0, 200]
              },
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 24 * 60 * 60
              }
            }
          },
          {
            urlPattern: /^\/cdn-cgi\/.*/,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/api\..*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200]
              },
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 5 * 60 // 5分钟
              }
            }
          },
          {
            urlPattern: /\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'local-api-cache',
              networkTimeoutSeconds: 8,
              cacheableResponse: {
                statuses: [0, 200]
              },
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 3 * 60 // 3分钟
              }
            }
          },

          {
            urlPattern: /.*\.(js|css)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 24 * 60 * 60 // 24小时
              }
            }
          },
          {
            urlPattern: /\.(png|jpg|jpeg|svg|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 7 * 24 * 60 * 60 // 7天
              }
            }
          },
          {
            urlPattern: /\.(woff|woff2|eot|ttf|otf)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30天
              }
            }
          }
        ]
      },
      includeAssets: ['favicon.ico', 'robots.txt', 'icons/*.png', 'offline.html'],
      manifest,
      devOptions: {
        enabled: true,
        type: 'module',

        navigateFallbackDenylist: [
          /^\/sub\/.*/,
          /^\/cdn-cgi\/.*/,
          /^\/[^/]+\/[^/]+(\?.*)?$/
        ],
      }
    }),
    {
      name: 'html-transform-rocket-loader',
      transformIndexHtml(html) {
        // 自动为所有 module script 添加 data-cfasync="false" 以防止 Cloudflare Rocket Loader 破坏加载
        return html.replace(/<script type="module"/g, '<script type="module" data-cfasync="false"');
      }
    }
  ],
  // 性能优化构建配置
  build: {
    // 启用CSS代码分割
    cssCodeSplit: true,
    // 优化依赖预构建
    commonjsOptions: {
      include: [/node_modules/]
    },
    rollupOptions: {
      output: {
        // 手动代码分割
        manualChunks: {
          // Vue核心单独打包
          vue: ['vue'],
          // Pinia单独打包
          pinia: ['pinia']
        },
        // 优化文件名
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.')
          const ext = info[info.length - 1]
          if (/\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/i.test(assetInfo.name)) {
            return `assets/media/[name]-[hash][extname]`
          }
          if (/\.(png|jpe?g|gif|svg)(\?.*)?$/i.test(assetInfo.name)) {
            return `assets/img/[name]-[hash][extname]`
          }
          if (/\.(woff2?|eot|ttf|otf)(\?.*)?$/i.test(assetInfo.name)) {
            return `assets/fonts/[name]-[hash][extname]`
          }
          return `assets/${ext}/[name]-[hash][extname]`
        }
      }
    },
    // 压缩配置
    minify: 'terser',

    // terserOptions removed for debugging
  },
  // 开发服务器配置
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      '/sub/': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      '^/(?!@|api/|sub/|assets/|@vite/|src/|icons/|images/)[^/]+/[^/]+$': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      // Catch-all proxy removed to fix SPA fallback
    }
  },
  // 依赖优化
  optimizeDeps: {
    include: [
      'vue',
      'pinia'
    ]
  },
  // 路径解析
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
