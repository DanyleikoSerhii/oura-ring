import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApiError } from '@/api/client'
import { getLastSync, resetDb, syncAll, type SyncProgress } from '@/db/sync'

export const useSyncStore = defineStore('sync', () => {
  const running = ref(false)
  const progress = ref<SyncProgress | null>(null)
  const error = ref<string | null>(null)
  const unauthorized = ref(false)
  const lastSyncAt = ref<string | null>(null)

  async function refreshLastSync() {
    lastSyncAt.value = (await getLastSync()) ?? null
  }

  async function run(options: { full?: boolean } = {}) {
    if (running.value) return
    running.value = true
    error.value = null
    unauthorized.value = false
    try {
      await syncAll((p) => (progress.value = p), options)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) unauthorized.value = true
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      running.value = false
      progress.value = null
      await refreshLastSync()
    }
  }

  async function reset() {
    await resetDb()
    await run({ full: false })
  }

  return { running, progress, error, unauthorized, lastSyncAt, run, reset, refreshLastSync }
})
