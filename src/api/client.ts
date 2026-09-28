import type { Paged } from './types'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const MAX_RETRIES = 5

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function request<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = `/oura/${path}?${new URLSearchParams(params)}`
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url)
    if (res.status === 429 && attempt < MAX_RETRIES) {
      const wait = Number(res.headers.get('retry-after')) || 5 * (attempt + 1)
      await sleep(wait * 1000)
      continue
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new ApiError(res.status, `${res.status} ${path}: ${body.slice(0, 200)}`)
    }
    return (await res.json()) as T
  }
}

/** Забирает все страницы ответа (пагинация через next_token). */
export async function fetchAll<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const items: T[] = []
  let nextToken: string | null | undefined
  do {
    const query = nextToken ? { ...params, next_token: nextToken } : params
    const page = await request<Paged<T>>(path, query)
    items.push(...page.data)
    nextToken = page.next_token
  } while (nextToken)
  return items
}
