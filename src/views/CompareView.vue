<script setup lang="ts">
import { computed, ref } from 'vue'
import { addDays, differenceInCalendarDays, format, parseISO, subDays } from 'date-fns'
import TrendChart from '@/components/charts/TrendChart.vue'
import ChartCard from '@/components/ui/ChartCard.vue'
import { metricValue, useDailyData } from '@/composables/useDailyData'
import { formatMetric, METRICS, METRIC_BY_ID, SECTION_COLOR } from '@/metrics/registry'
import { mean, nonNull } from '@/utils/stats'

const FMT = 'yyyy-MM-dd'
const { table, loading } = useDailyData()

const lastDay = computed(
  () => table.value.days[table.value.days.length - 1] ?? format(new Date(), FMT),
)

type Preset = 'week' | 'month' | 'custom'
const preset = ref<Preset>('week')
const custom = ref({ aFrom: '', aTo: '', bFrom: '', bTo: '' })

const ranges = computed(() => {
  const end = parseISO(lastDay.value)
  if (preset.value === 'custom') {
    return {
      a: [custom.value.aFrom, custom.value.aTo] as [string, string],
      b: [custom.value.bFrom, custom.value.bTo] as [string, string],
    }
  }
  const n = preset.value === 'week' ? 7 : 30
  const aFrom = subDays(end, n - 1)
  const bTo = subDays(aFrom, 1)
  const bFrom = subDays(bTo, n - 1)
  return {
    a: [format(aFrom, FMT), format(end, FMT)] as [string, string],
    b: [format(bFrom, FMT), format(bTo, FMT)] as [string, string],
  }
})

function daysOf([from, to]: [string, string]): string[] {
  if (!from || !to || from > to) return []
  const n = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1
  return Array.from({ length: n }, (_, i) => format(addDays(parseISO(from), i), FMT))
}
const daysA = computed(() => daysOf(ranges.value.a))
const daysB = computed(() => daysOf(ranges.value.b))

const valuesOf = (id: string, days: string[]) => days.map((d) => metricValue(table.value, id, d))

const rows = computed(() =>
  METRICS.map((def) => {
    const a = mean(nonNull(valuesOf(def.id, daysA.value)))
    const b = mean(nonNull(valuesOf(def.id, daysB.value)))
    const diff = a != null && b != null ? a - b : null
    const pct = diff != null && b ? (diff / Math.abs(b)) * 100 : null
    let tone = 'text-muted'
    if (diff != null && Math.abs(diff) > 1e-9 && def.better)
      tone = diff > 0 === (def.better === 'up') ? 'text-good' : 'text-bad'
    return { def, a, b, diff, pct, tone }
  }).filter((r) => r.a != null || r.b != null),
)

const chartMetric = ref('sleep_score')
const chartLen = computed(() => Math.max(daysA.value.length, daysB.value.length))
const chartSeries = computed(() => {
  const def = METRIC_BY_ID[chartMetric.value]!
  const fmt = (v: number) => formatMetric(def, v)
  return [
    {
      name: 'Период A',
      color: SECTION_COLOR.sleep,
      data: valuesOf(chartMetric.value, daysA.value),
      unit: def.unit,
      format: fmt,
    },
    {
      name: 'Период B',
      color: '#8a90a2',
      data: valuesOf(chartMetric.value, daysB.value),
      unit: def.unit,
      format: fmt,
      dashed: true,
    },
  ]
})
const categories = computed(() => Array.from({ length: chartLen.value }, (_, i) => `День ${i + 1}`))

const fmtRange = ([f, t]: [string, string]) => (f && t ? `${f} — ${t}` : 'не задан')
const signed = (v: number, digits = 1) =>
  `${v > 0 ? '+' : ''}${v.toLocaleString('ru-RU', { maximumFractionDigits: digits })}`
</script>

<template>
  <div class="flex flex-col gap-5">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-semibold">Сравнение периодов</h1>
      <div class="inline-flex rounded-lg border border-line bg-surface p-0.5 text-xs">
        <button
          v-for="p in [
            ['week', 'Неделя к неделе'],
            ['month', '30 дней к 30'],
            ['custom', 'Свои даты'],
          ] as [Preset, string][]"
          :key="p[0]"
          type="button"
          class="rounded-md px-3 py-1.5 transition-colors"
          :class="preset === p[0] ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg'"
          @click="preset = p[0]"
        >
          {{ p[1] }}
        </button>
      </div>
    </header>

    <div
      class="flex flex-wrap items-center gap-6 rounded-2xl border border-line bg-surface p-5 text-sm"
    >
      <div>
        <div class="text-xs text-muted">Период A</div>
        <div v-if="preset !== 'custom'" class="font-medium">{{ fmtRange(ranges.a) }}</div>
        <div v-else class="flex gap-2">
          <input
            v-model="custom.aFrom"
            type="date"
            class="rounded-md border border-line bg-surface-2 px-2 py-1"
          />
          <input
            v-model="custom.aTo"
            type="date"
            class="rounded-md border border-line bg-surface-2 px-2 py-1"
          />
        </div>
      </div>
      <div>
        <div class="text-xs text-muted">Период B (с чем сравниваем)</div>
        <div v-if="preset !== 'custom'" class="font-medium">{{ fmtRange(ranges.b) }}</div>
        <div v-else class="flex gap-2">
          <input
            v-model="custom.bFrom"
            type="date"
            class="rounded-md border border-line bg-surface-2 px-2 py-1"
          />
          <input
            v-model="custom.bTo"
            type="date"
            class="rounded-md border border-line bg-surface-2 px-2 py-1"
          />
        </div>
      </div>
    </div>

    <section class="grid grid-cols-12 gap-5">
      <ChartCard
        class="col-span-12 xl:col-span-7"
        title="Метрики"
        :loading="loading"
        :empty="!rows.length"
        empty-text="Нет данных за выбранные периоды"
      >
        <table class="w-full text-sm">
          <thead class="text-left text-xs text-muted">
            <tr>
              <th class="py-2 font-normal">Метрика</th>
              <th class="text-right font-normal">A</th>
              <th class="text-right font-normal">B</th>
              <th class="text-right font-normal">Разница</th>
              <th class="text-right font-normal">%</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in rows"
              :key="r.def.id"
              class="cursor-pointer border-t border-line hover:bg-surface-2/60"
              :class="{ 'bg-surface-2/60': chartMetric === r.def.id }"
              @click="chartMetric = r.def.id"
            >
              <td class="py-2">
                {{ r.def.label }} <span class="text-xs text-muted">{{ r.def.unit }}</span>
              </td>
              <td class="text-right">{{ formatMetric(r.def, r.a) }}</td>
              <td class="text-right text-muted">{{ formatMetric(r.def, r.b) }}</td>
              <td class="text-right" :class="r.tone">
                {{ r.diff != null && !r.def.asClock ? signed(r.diff, r.def.digits || 1) : '—' }}
              </td>
              <td class="text-right" :class="r.tone">
                {{
                  r.pct != null && !r.def.asClock && !r.def.signed ? signed(r.pct, 0) + '%' : '—'
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </ChartCard>
      <ChartCard
        class="col-span-12 xl:col-span-5"
        :title="METRIC_BY_ID[chartMetric]!.label"
        subtitle="Периоды наложены по дням. Выберите метрику в таблице"
        :empty="!chartLen"
      >
        <TrendChart :days="[]" :categories="categories" :series="chartSeries" :height="320" />
      </ChartCard>
    </section>
  </div>
</template>
