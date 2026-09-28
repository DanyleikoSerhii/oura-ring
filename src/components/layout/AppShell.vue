<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  Activity,
  GitCompareArrows,
  HeartPulse,
  LayoutDashboard,
  Loader2,
  Moon,
  RefreshCw,
  ScatterChart,
  Sparkles,
  TriangleAlert,
} from 'lucide-vue-next'
import { useSyncStore } from '@/stores/sync'

const NAV = [
  { to: '/', label: 'Дашборд', icon: LayoutDashboard },
  { to: '/sleep', label: 'Сон', icon: Moon },
  { to: '/activity', label: 'Активность', icon: Activity },
  { to: '/recovery', label: 'Восстановление', icon: HeartPulse },
  { to: '/compare', label: 'Сравнение', icon: GitCompareArrows },
  { to: '/correlations', label: 'Корреляции', icon: ScatterChart },
  { to: '/export', label: 'Данные для AI', icon: Sparkles },
]

const route = useRoute()
const sync = useSyncStore()
const progressText = computed(() => {
  const p = sync.progress
  return p ? `${p.label} · ${p.done}/${p.total}` : ''
})
</script>

<template>
  <div class="flex min-h-screen">
    <aside
      class="sticky top-0 flex h-screen w-16 shrink-0 flex-col items-center gap-2 border-r border-line bg-surface py-4 lg:w-56 lg:items-stretch lg:px-3"
    >
      <div class="mb-4 flex items-center gap-2 px-2 text-lg font-semibold">
        <span class="inline-block size-5 rounded-full border-[5px] border-sleep" />
        <span class="hidden lg:inline">Oura</span>
      </div>
      <RouterLink
        v-for="item in NAV"
        :key="item.to"
        :to="item.to"
        :title="item.label"
        class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        :class="{ '!bg-surface-2 !text-fg': route.path === item.to }"
      >
        <component :is="item.icon" class="size-5 shrink-0" />
        <span class="hidden lg:inline">{{ item.label }}</span>
      </RouterLink>

      <RouterLink
        to="/sync"
        title="Синхронизация"
        class="mt-auto flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        :class="{ '!bg-surface-2 !text-fg': route.path === '/sync' }"
      >
        <Loader2 v-if="sync.running" class="size-5 shrink-0 animate-spin text-sleep" />
        <TriangleAlert v-else-if="sync.error" class="size-5 shrink-0 text-bad" />
        <RefreshCw v-else class="size-5 shrink-0" />
        <span class="hidden truncate lg:inline">
          {{ sync.running ? progressText || 'Синхронизация…' : 'Синхронизация' }}
        </span>
      </RouterLink>
    </aside>

    <main class="min-w-0 flex-1 p-6">
      <div class="mx-auto max-w-[1600px]"><slot /></div>
    </main>
  </div>
</template>
