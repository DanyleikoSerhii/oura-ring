import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Без префикса VITE_: токен остаётся на стороне Node и не попадает в клиентский бандл.
  const env = loadEnv(mode, process.cwd(), '')
  const proxy = {
    '/oura': {
      target: 'https://api.ouraring.com',
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/oura/, '/v2/usercollection'),
      headers: env.OURA_TOKEN ? { Authorization: `Bearer ${env.OURA_TOKEN}` } : {},
    },
  }
  return {
    plugins: [vue(), vueDevTools(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: { proxy },
    preview: { proxy },
    define: { __HAS_TOKEN__: JSON.stringify(Boolean(env.OURA_TOKEN)) },
  }
})
