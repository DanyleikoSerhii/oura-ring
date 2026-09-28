<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Loader2, RefreshCw, Trash2 } from 'lucide-vue-next'
import ChartCard from '@/components/ui/ChartCard.vue'
import { useLive } from '@/composables/useLive'
import { db } from '@/db/schema'
import { ENDPOINTS } from '@/db/sync'
import { useSyncStore } from '@/stores/sync'

const sync = useSyncStore()
const hasToken = __HAS_TOKEN__
const confirmReset = ref(false)

const { data: counts } = useLive(
  async () => {
    const entries = await Promise.all(
      ENDPOINTS.map(async (e) => [e.table, await db[e.table].count()] as const),
    )
    return Object.fromEntries(entries) as Record<string, number>
  },
  {} as Record<string, number>,
)
const { data: historyStart } = useLive(
  async () => (await db.meta.get('historyStart'))?.value,
  undefined,
)

onMounted(() => sync.refreshLastSync())

const last = computed(() =>
  sync.lastSyncAt
    ? format(parseISO(sync.lastSyncAt), 'd MMMM yyyy, HH:mm', { locale: ru })
    : 'ещё не выполнялась',
)
const percent = computed(() => {
  const p = sync.progress
  return p && p.total ? Math.round((p.done / p.total) * 100) : 0
})

async function reset() {
  confirmReset.value = false
  await sync.reset()
}
</script>

<template>
  <div class="flex max-w-3xl flex-col gap-5">
    <h1 class="text-xl font-semibold">Синхронизация</h1>

    <div v-if="!hasToken" class="rounded-2xl border border-bad/40 bg-bad/10 p-5 text-sm">
      <p class="font-medium">Токен Oura не найден</p>
      <p class="mt-1 text-muted">
        Скопируйте <code>.env.example</code> в <code>.env.local</code>, впишите
        <code>OURA_TOKEN</code> и перезапустите <code>pnpm dev</code>.
      </p>
    </div>

    <div v-if="sync.error" class="rounded-2xl border border-bad/40 bg-bad/10 p-5 text-sm">
      <p class="font-medium">
        {{ sync.unauthorized ? 'Токен недействителен' : 'Ошибка синхронизации' }}
      </p>
      <p class="mt-1 break-words text-muted">
        {{
          sync.unauthorized
            ? 'Обновите OURA_TOKEN в .env.local и перезапустите dev-сервер.'
            : sync.error
        }}
      </p>
    </div>

    <ChartCard title="Состояние" :subtitle="`Последняя синхронизация: ${last}`">
      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg bg-sleep px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
          :disabled="sync.running || !hasToken"
          @click="sync.run()"
        >
          <Loader2 v-if="sync.running" class="size-4 animate-spin" />
          <RefreshCw v-else class="size-4" />
          Обновить
        </button>
        <template v-if="!confirmReset">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-fg disabled:opacity-50"
            :disabled="sync.running || !hasToken"
            @click="confirmReset = true"
          >
            <Trash2 class="size-4" />
            Сбросить и загрузить заново
          </button>
        </template>
        <template v-else>
          <span class="text-sm text-muted">Локальная база будет очищена. Продолжить?</span>
          <button
            type="button"
            class="rounded-lg bg-bad px-3 py-2 text-sm font-medium text-bg"
            @click="reset"
          >
            Да, сбросить
          </button>
          <button
            type="button"
            class="rounded-lg border border-line px-3 py-2 text-sm text-muted"
            @click="confirmReset = false"
          >
            Отмена
          </button>
        </template>
      </div>

      <div v-if="sync.running && sync.progress" class="mt-4">
        <div class="mb-1 flex justify-between text-xs text-muted">
          <span>{{ sync.progress.label }}</span>
          <span>{{ sync.progress.done }} / {{ sync.progress.total }}</span>
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-line">
          <div
            class="h-full rounded-full bg-sleep transition-[width]"
            :style="{ width: `${percent}%` }"
          />
        </div>
      </div>
    </ChartCard>

    <ChartCard
      title="Данные в локальной базе"
      :subtitle="historyStart ? `История с ${historyStart}` : undefined"
    >
      <table class="w-full text-sm">
        <tbody>
          <tr v-for="e in ENDPOINTS" :key="e.table" class="border-t border-line first:border-0">
            <td class="py-2">{{ e.label }}</td>
            <td class="text-right text-muted">{{ counts[e.table] ?? 0 }}</td>
          </tr>
        </tbody>
      </table>
    </ChartCard>
  </div>
</template>
