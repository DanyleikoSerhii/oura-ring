import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'
import { ouraProxy } from './tools/oura-proxy.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Без префикса VITE_: секреты остаются на стороне Node и не попадают в клиентский бандл.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [vue(), vueDevTools(), tailwindcss(), ouraProxy(env)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
