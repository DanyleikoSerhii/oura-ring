import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApiError } from '@/api/client'
import { getLastSync, resetDb, syncAll, type EndpointFailure, type SyncProgress } from '@/db/sync'

export interface AuthStatus {
  authorized: boolean
  hasClient: boolean
  scope: string | null
}

export const useSyncStore = defineStore('sync', () => {
  const running = ref(false)
  const progress = ref<SyncProgress | null>(null)
  const error = ref<string | null>(null)
  const unauthorized = ref(false)
  const failures = ref<EndpointFailure[]>([])
  const lastSyncAt = ref<string | null>(null)
  const auth = ref<AuthStatus | null>(null)

  async function refreshLastSync() {
    lastSyncAt.value = (await getLastSync()) ?? null
  }

  async function checkAuth() {
    try {
      const res = await fetch('/oura-status')
      auth.value = res.ok ? ((await res.json()) as AuthStatus) : null
    } catch {
      auth.value = null
    }
    return auth.value
  }

  async function run(options: { full?: boolean } = {}) {
    if (running.value) return
    running.value = true
    error.value = null
    unauthorized.value = false
    failures.value = []
    try {
      failures.value = await syncAll((p) => (progress.value = p), options)
      // Все эндпоинты отказали с 401 — токен недействителен и не обновляется.
      if (failures.value.length && failures.value.every((f) => f.status === 401)) {
        unauthorized.value = true
        error.value = 'Oura отклонила токен'
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) unauthorized.value = true
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      running.value = false
      progress.value = null
      await refreshLastSync()
      await checkAuth()
    }
  }

  async function reset() {
    await resetDb()
    await run()
  }

  return {
    running,
    progress,
    error,
    unauthorized,
    failures,
    lastSyncAt,
    auth,
    run,
    reset,
    refreshLastSync,
    checkAuth,
  }
})
