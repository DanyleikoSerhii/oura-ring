import { readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export const AUTH_URL = 'https://cloud.ouraring.com/oauth/authorize'
export const TOKEN_URL = 'https://api.ouraring.com/oauth/token'
export const TOKEN_FILE = resolve(process.cwd(), '.oura-tokens.json')

/**
 * Oura принимает названия скоупов, которые не совпадают с опубликованной OpenAPI-схемой
 * (например, `spo2` вместо `spo2Daily`), а неизвестный скоуп молча отбрасывается на экране
 * согласия. Поэтому по умолчанию запрашиваем оба варианта написания.
 */
export const DEFAULT_SCOPES =
  'personal daily heartrate workout session spo2 spo2Daily stress heart_health heartHealth'

export interface OuraEnv {
  OURA_CLIENT_ID?: string
  OURA_CLIENT_SECRET?: string
  OURA_SCOPES?: string
  /** Переопределение адресов (для локальных проверок). */
  OURA_TOKEN_URL?: string
  OURA_API_URL?: string
  OURA_REDIRECT_PORT?: string
  /** Готовый токен доступа (старый личный токен или полученный вручную). */
  OURA_TOKEN?: string
}

export interface StoredTokens {
  access_token: string
  refresh_token?: string
  /** Момент истечения access token, мс с эпохи. */
  expires_at?: number
  scope?: string
}

export async function loadTokens(): Promise<StoredTokens | null> {
  try {
    return JSON.parse(await readFile(TOKEN_FILE, 'utf8')) as StoredTokens
  } catch {
    return null
  }
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  // Refresh token одноразовый: пишем атомарно, чтобы не потерять новое значение.
  const tmp = `${TOKEN_FILE}.tmp`
  await writeFile(tmp, JSON.stringify(tokens, null, 2), { mode: 0o600 })
  await rename(tmp, TOKEN_FILE)
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  scope?: string
}

async function requestToken(env: OuraEnv, params: Record<string, string>): Promise<StoredTokens> {
  if (!env.OURA_CLIENT_ID || !env.OURA_CLIENT_SECRET) {
    throw new Error('Не заданы OURA_CLIENT_ID и OURA_CLIENT_SECRET в .env.local')
  }
  const body = new URLSearchParams({
    ...params,
    client_id: env.OURA_CLIENT_ID,
    client_secret: env.OURA_CLIENT_SECRET,
  })
  const res = await fetch(env.OURA_TOKEN_URL ?? TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Oura token endpoint: ${res.status} ${text.slice(0, 300)}`)
  const json = JSON.parse(text) as TokenResponse
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: json.expires_in ? Date.now() + json.expires_in * 1000 : undefined,
    scope: json.scope,
  }
}

export function exchangeCode(env: OuraEnv, code: string, redirectUri: string) {
  return requestToken(env, { grant_type: 'authorization_code', code, redirect_uri: redirectUri })
}

export async function refreshTokens(env: OuraEnv, current: StoredTokens): Promise<StoredTokens> {
  if (!current.refresh_token) throw new Error('Нет refresh token — выполните pnpm oura:auth')
  const next = await requestToken(env, {
    grant_type: 'refresh_token',
    refresh_token: current.refresh_token,
  })
  // Если сервер не вернул новый refresh token, оставляем прежний.
  const merged: StoredTokens = {
    ...next,
    refresh_token: next.refresh_token ?? current.refresh_token,
    scope: next.scope ?? current.scope,
  }
  await saveTokens(merged)
  return merged
}
