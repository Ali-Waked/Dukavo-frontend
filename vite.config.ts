import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const backendUrl = env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8000'

  return {
    plugins: [tailwindcss(), vue(), vueDevTools()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          // TEMP: production debugging
          ...(backendUrl.startsWith('https:')
            ? { secure: true, cookieDomainRewrite: '' }
            : {}),
        },
        // Sanctum's CSRF cookie endpoint lives outside /api. Without it the
        // browser holds no XSRF token and every stateful request is rejected
        // with 419 before it reaches the application.
        '/sanctum': {
          target: backendUrl,
          changeOrigin: true,
          // TEMP: production debugging
          ...(backendUrl.startsWith('https:')
            ? { secure: true, cookieDomainRewrite: '' }
            : {}),
        },
      },
    },
    build: {
      // Route chunks are already split by the router's dynamic imports; keeping
      // the vendor chunks explicit stops a shared blob from changing on every
      // dependency bump. Vite 8 only accepts a function here.
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined
            }
            if (
              id.includes('/vue/') ||
              id.includes('@vue/') ||
              id.includes('/pinia/') ||
              id.includes('/vue-router/') ||
              id.includes('@lucide/')
            ) {
              return 'vendor-core'
            }
            if (id.includes('/axios/')) {
              return 'vendor-http'
            }
            return 'vendor'
          },
        },
      },
    },
  }
})
