<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import AppShell from '@/components/layout/AppShell.vue'
import { useSyncStore } from '@/stores/sync'

const sync = useSyncStore()
const STALE_MS = 60 * 60 * 1000

onMounted(async () => {
  await sync.refreshLastSync()
  if (!__HAS_TOKEN__) return
  const last = sync.lastSyncAt ? Date.parse(sync.lastSyncAt) : 0
  if (Date.now() - last > STALE_MS) void sync.run()
})
</script>

<template>
  <AppShell>
    <RouterView />
  </AppShell>
</template>
