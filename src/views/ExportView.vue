<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, ClipboardCopy, Download } from 'lucide-vue-next'
import ChartCard from '@/components/ui/ChartCard.vue'
import { useDailyData } from '@/composables/useDailyData'
import { buildAiReport } from '@/utils/aiExport'

const CONTEXT_KEY = 'oura:ai-context'

const { table, loading } = useDailyData()

const days = ref(30)
const includeDaily = ref(true)
const includeCorrelations = ref(true)
const context = ref(readContext())

function readContext(): string {
  try {
    return localStorage.getItem(CONTEXT_KEY) ?? ''
  } catch {
    return ''
  }
}
watch(context, (v) => {
  try {
    localStorage.setItem(CONTEXT_KEY, v)
  } catch {
    // Хранилище недоступно — контекст просто не запомнится.
  }
})

const PERIODS = [
  { value: 7, label: '7 дней' },
  { value: 14, label: '14 дней' },
  { value: 30, label: '30 дней' },
  { value: 90, label: '90 дней' },
]

const report = computed(() =>
  buildAiReport(table.value, {
    days: days.value,
    includeDaily: includeDaily.value,
    includeCorrelations: includeCorrelations.value,
    context: context.value,
  }),
)

// Грубая оценка: кириллица занимает больше токенов, чем латиница.
const tokens = computed(() => Math.round(report.value.length / 2.5))

const copied = ref(false)
async function copy() {
  try {
    await navigator.clipboard.writeText(report.value)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = report.value
    document.body.append(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

function download() {
  const blob = new Blob([report.value], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `oura-${table.value.days[table.value.days.length - 1] ?? 'report'}.md`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <header>
      <h1 class="text-xl font-semibold">Данные для AI</h1>
      <p class="mt-1 text-sm text-muted">
        Готовый текст с инструкцией и вашими показателями. Скопируйте его и вставьте в чат с AI,
        чтобы получить разбор и советы.
      </p>
    </header>

    <section class="grid grid-cols-12 gap-5">
      <div class="col-span-12 flex flex-col gap-5 xl:col-span-4">
        <ChartCard title="Настройки">
          <div class="flex flex-col gap-4 text-sm">
            <div>
              <div class="mb-1 text-xs text-muted">Период</div>
              <div class="inline-flex rounded-lg border border-line bg-surface-2 p-0.5 text-xs">
                <button
                  v-for="p in PERIODS"
                  :key="p.value"
                  type="button"
                  class="rounded-md px-3 py-1.5 transition-colors"
                  :class="days === p.value ? 'bg-surface text-fg' : 'text-muted hover:text-fg'"
                  @click="days = p.value"
                >
                  {{ p.label }}
                </button>
              </div>
            </div>
            <label class="flex items-center gap-2">
              <input v-model="includeDaily" type="checkbox" class="accent-sleep" />
              Таблица по дням
            </label>
            <label class="flex items-center gap-2">
              <input v-model="includeCorrelations" type="checkbox" class="accent-sleep" />
              Корреляции по всей истории
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs text-muted">Контекст и цель (необязательно, запоминается)</span>
              <textarea
                v-model="context"
                rows="5"
                placeholder="Например: 34 года, работаю из дома, бегаю 3 раза в неделю. Хочу засыпать раньше и поднять HRV."
                class="resize-y rounded-md border border-line bg-surface-2 px-3 py-2 placeholder:text-muted/60"
              />
            </label>
          </div>
        </ChartCard>

        <div class="flex flex-wrap gap-3">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-sleep px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
            :disabled="!report"
            @click="copy"
          >
            <component :is="copied ? Check : ClipboardCopy" class="size-4" />
            {{ copied ? 'Скопировано' : 'Скопировать' }}
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-fg disabled:opacity-50"
            :disabled="!report"
            @click="download"
          >
            <Download class="size-4" />
            Скачать .md
          </button>
        </div>
        <p v-if="report" class="text-xs text-muted">
          {{ report.length.toLocaleString('ru-RU') }} символов, ≈
          {{ tokens.toLocaleString('ru-RU') }} токенов
        </p>
      </div>

      <ChartCard
        class="col-span-12 xl:col-span-8"
        title="Предпросмотр"
        :loading="loading"
        :empty="!report"
        empty-text="Нет данных — сначала запустите синхронизацию"
      >
        <pre
          class="max-h-[75vh] overflow-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-4 font-mono text-xs leading-relaxed"
          >{{ report }}</pre>
      </ChartCard>
    </section>
  </div>
</template>
