import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { loadTokens, refreshTokens, type OuraEnv, type StoredTokens } from './oura-tokens.ts'

const DEFAULT_API = 'https://api.ouraring.com/v2/usercollection'
const REFRESH_MARGIN_MS = 60_000

type Next = () => void

/**
 * Dev/preview-прокси к Oura API: подставляет токен на стороне Node (в браузер он не попадает),
 * сам обновляет access token по одноразовому refresh token и повторяет запрос после 401.
 */
export function ouraProxy(env: OuraEnv): Plugin {
  let refreshing: Promise<StoredTokens> | null = null

  // Параллельные запросы не должны тратить один и тот же одноразовый refresh token дважды.
  const refresh = (tokens: StoredTokens) => {
    refreshing ??= refreshTokens(env, tokens).finally(() => (refreshing = null))
    return refreshing
  }

  async function currentAccessToken(): Promise<{
    token: string
    tokens: StoredTokens | null
  } | null> {
    let tokens = await loadTokens()
    if (tokens) {
      const expiring =
        tokens.expires_at != null && tokens.expires_at - Date.now() < REFRESH_MARGIN_MS
      if (expiring && tokens.refresh_token) tokens = await refresh(tokens)
      return { token: tokens.access_token, tokens }
    }
    return env.OURA_TOKEN ? { token: env.OURA_TOKEN, tokens: null } : null
  }

  const json = (res: ServerResponse, status: number, body: unknown) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(body))
  }

  async function status(res: ServerResponse) {
    const tokens = await loadTokens()
    json(res, 200, {
      authorized: Boolean(tokens || env.OURA_TOKEN),
      hasClient: Boolean(env.OURA_CLIENT_ID && env.OURA_CLIENT_SECRET),
      scope: tokens?.scope ?? null,
    })
  }

  async function proxy(req: IncomingMessage, res: ServerResponse) {
    const target = `${env.OURA_API_URL ?? DEFAULT_API}${req.url ?? '/'}`
    let auth = await currentAccessToken()
    if (!auth) return json(res, 401, { detail: 'no_token' })

    let upstream = await fetch(target, { headers: { Authorization: `Bearer ${auth.token}` } })
    if (upstream.status === 401 && auth.tokens?.refresh_token) {
      const tokens = await refresh(auth.tokens)
      auth = { token: tokens.access_token, tokens }
      upstream = await fetch(target, { headers: { Authorization: `Bearer ${auth.token}` } })
    }

    res.statusCode = upstream.status
    for (const name of ['content-type', 'retry-after']) {
      const value = upstream.headers.get(name)
      if (value) res.setHeader(name, value)
    }
    res.end(Buffer.from(await upstream.arrayBuffer()))
  }

  const install = (
    use: (
      path: string,
      fn: (req: IncomingMessage, res: ServerResponse, next: Next) => void,
    ) => void,
  ) => {
    use('/oura-status', (_req, res) => {
      status(res).catch((e) => json(res, 500, { detail: String(e) }))
    })
    use('/oura', (req, res) => {
      proxy(req, res).catch((e) => json(res, 502, { detail: String(e) }))
    })
  }

  return {
    name: 'oura-proxy',
    configureServer: (server) => install((p, fn) => server.middlewares.use(p, fn)),
    configurePreviewServer: (server) => install((p, fn) => server.middlewares.use(p, fn)),
  }
}
