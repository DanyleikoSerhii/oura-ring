// Разовый вход в Oura по OAuth2 (authorization code). Запуск: pnpm oura:auth
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { loadEnv } from 'vite'
import {
  AUTH_URL,
  DEFAULT_SCOPES,
  TOKEN_FILE,
  exchangeCode,
  saveTokens,
} from '../tools/oura-tokens.ts'

const env = loadEnv('development', process.cwd(), '')
const port = Number(env.OURA_REDIRECT_PORT ?? 9876)
const redirectUri = `http://localhost:${port}/callback`
const scope = env.OURA_SCOPES ?? DEFAULT_SCOPES

if (!env.OURA_CLIENT_ID || !env.OURA_CLIENT_SECRET) {
  console.error(`Не заданы OURA_CLIENT_ID / OURA_CLIENT_SECRET в .env.local.

1. Создайте приложение: https://cloud.ouraring.com/oauth/applications
2. Redirect URI укажите ровно такой: ${redirectUri}
3. Впишите Client ID и Client Secret в .env.local (см. .env.example) и запустите команду снова.`)
  process.exit(1)
}

const state = randomBytes(16).toString('hex')
const authUrl = `${AUTH_URL}?${new URLSearchParams({
  response_type: 'code',
  client_id: env.OURA_CLIENT_ID,
  redirect_uri: redirectUri,
  scope,
  state,
})}`

const page = (text: string) =>
  `<!doctype html><meta charset="utf-8"><body style="font:16px system-ui;background:#0b0d12;color:#e8eaf0;padding:3rem">${text}</body>`

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', redirectUri)
  if (url.pathname.replace(/\/$/, '') !== '/callback') {
    res.statusCode = 404
    return res.end()
  }
  const fail = (message: string) => {
    res.statusCode = 400
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(page(`Ошибка: ${message}`))
    console.error(`Ошибка: ${message}`)
    finish(1)
  }
  if (url.searchParams.get('error')) return fail(url.searchParams.get('error')!)
  if (url.searchParams.get('state') !== state) return fail('неверный state')
  const code = url.searchParams.get('code')
  if (!code) return fail('нет кода авторизации')
  try {
    const tokens = await exchangeCode(env, code, redirectUri)
    await saveTokens(tokens)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(page('Готово. Токены сохранены, вкладку можно закрыть.'))
    console.log(`Токены сохранены в ${TOKEN_FILE}`)
    console.log(`Выданные скоупы: ${tokens.scope ?? '(сервер не сообщил)'}`)
    if (!tokens.refresh_token)
      console.warn('Внимание: refresh token не выдан — вход придётся повторять.')
    finish(0)
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e))
  }
})

function finish(code: number) {
  server.close()
  clearTimeout(timer)
  setTimeout(() => process.exit(code), 100)
}

const timer = setTimeout(() => {
  console.error('Время ожидания истекло (5 минут).')
  finish(1)
}, 5 * 60_000)

server.listen(port, () => {
  console.log(`Redirect URI (должен совпадать с настройкой приложения в Oura): ${redirectUri}\n`)
  console.log(`Откройте в браузере и разрешите доступ:\n\n${authUrl}\n`)
  console.log('Ожидаю подтверждение…')
})
