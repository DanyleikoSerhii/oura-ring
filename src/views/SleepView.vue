<script setup lang="ts">
import { computed, toRef } from 'vue'
import { format, parseISO } from 'date-fns'
import Hypnogram from '@/components/charts/Hypnogram.vue'
import TrendChart from '@/components/charts/TrendChart.vue'
import ChartCard from '@/components/ui/ChartCard.vue'
import DayPicker from '@/components/ui/DayPicker.vue'
import MetricTile from '@/components/ui/MetricTile.vue'
import PeriodSelect from '@/components/ui/PeriodSelect.vue'
import { baselineFor, metricValue, useDailyData } from '@/composables/useDailyData'
import { useTrend } from '@/composables/useTrend'
import { formatClock, formatDuration, SECTION_COLOR } from '@/metrics/registry'
import { useDayStore } from '@/stores/period'

const store = useDayStore()
const { table, loading } = useDailyData()
const trend = useTrend(table, toRef(store, 'range'))

const sleep = computed(() => table.value.byDay.get(store.day)?.sleep)
const clock = (iso?: string) => (iso ? format(parseISO(iso), 'HH:mm') : '—')

const TILES = ['sleep_hours', 'efficiency', 'latency_min', 'deep_min', 'rem_min', 'breathing']
const tiles = computed(() =>
  TILES.map((id) => ({
    id,
    value: metricValue(table.value, id, store.day),
    baseline: baselineFor(table.value, id, store.day),
  })),
)

/** Ряд за ночь (пульс или HRV): подписи времени по интервалу семплирования. */
function nightSeries(kind: 'heart_rate' | 'hrv') {
  const s = sleep.value?.[kind]
  if (!s) return null
  const t0 = new Date(s.timestamp).getTime()
  const labels = s.items.map((_, i) => format(new Date(t0 + i * s.interval * 1000), 'HH:mm'))
  return { labels, data: s.items }
}
const night = computed(() => ({ heart: nightSeries('heart_rate'), hrv: nightSeries('hrv') }))

const stack = computed(() => [
  {
    name: 'Глубокий',
    color: '#4b3fd6',
    data: trend.values('deep_min'),
    type: 'bar' as const,
    unit: 'мин',
  },
  {
    name: 'REM',
    color: '#3dd6c6',
    data: trend.values('rem_min'),
    type: 'bar' as const,
    unit: 'мин',
  },
  {
    name: 'Лёгкий',
    color: '#7c83fd',
    data: trend.values('light_min'),
    type: 'bar' as const,
    unit: 'мин',
  },
])
const bedtimeSeries = computed(() => [
  {
    ...trend.series('bedtime')[0]!,
    format: formatClock,
  },
])
const zoom = computed(() => trend.days.value.length > 120)
</script>

<template>
  <div class="flex flex-col gap-5">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-semibold">Сон</h1>
      <DayPicker />
    </header>

    <section class="grid grid-cols-12 gap-5">
      <ChartCard
        class="col-span-12 xl:col-span-8"
        title="Ночь"
        :subtitle="
          sleep
            ? `${clock(sleep.bedtime_start)} – ${clock(sleep.bedtime_end)} · ${formatDuration(sleep.total_sleep_duration)} сна`
            : undefined
        "
        :loading="loading"
        :empty="!sleep"
        empty-text="Нет данных о сне за этот день"
      >
        <Hypnogram
          v-if="sleep?.sleep_phase_5_min"
          :phases="sleep.sleep_phase_5_min"
          :start="sleep.bedtime_start"
          :height="220"
        />
      </ChartCard>
      <div class="col-span-12 grid grid-cols-2 content-start gap-3 xl:col-span-4">
        <MetricTile
          v-for="t in tiles"
          :key="t.id"
          :metric-id="t.id"
          :value="t.value"
          :baseline="t.baseline"
        />
      </div>
    </section>

    <section class="grid grid-cols-12 gap-5">
      <ChartCard class="col-span-12 md:col-span-6" title="Пульс за ночь" :empty="!night.heart">
        <TrendChart
          v-if="night.heart"
          :days="[]"
          :categories="night.heart.labels"
          :series="[
            { name: 'Пульс', color: SECTION_COLOR.heart, data: night.heart.data, unit: 'уд/мин' },
          ]"
          :height="180"
        />
      </ChartCard>
      <ChartCard class="col-span-12 md:col-span-6" title="HRV за ночь" :empty="!night.hrv">
        <TrendChart
          v-if="night.hrv"
          :days="[]"
          :categories="night.hrv.labels"
          :series="[
            { name: 'HRV', color: SECTION_COLOR.readiness, data: night.hrv.data, unit: 'мс' },
          ]"
          :height="180"
        />
      </ChartCard>
    </section>

    <div class="flex items-center justify-between">
      <h2 class="text-base font-semibold">Тренды</h2>
      <PeriodSelect v-model="store.range" />
    </div>

    <section class="grid grid-cols-12 gap-5">
      <ChartCard
        class="col-span-12 xl:col-span-6"
        title="Оценка сна"
        :empty="!trend.days.value.length"
      >
        <TrendChart
          :days="trend.days.value"
          :series="trend.series('sleep_score')"
          :zoom="zoom"
          :height="230"
        />
      </ChartCard>
      <ChartCard
        class="col-span-12 xl:col-span-6"
        title="Длительность сна, ч"
        :empty="!trend.days.value.length"
      >
        <TrendChart
          :days="trend.days.value"
          :series="trend.series('sleep_hours', 'bar')"
          :zoom="zoom"
          :height="230"
        />
      </ChartCard>
      <ChartCard
        class="col-span-12 xl:col-span-6"
        title="Фазы сна, мин"
        :empty="!trend.days.value.length"
      >
        <TrendChart :days="trend.days.value" :series="stack" :zoom="zoom" :height="230" />
      </ChartCard>
      <ChartCard
        class="col-span-12 xl:col-span-6"
        title="Время отбоя"
        subtitle="Регулярность режима"
        :empty="!trend.days.value.length"
      >
        <TrendChart
          :days="trend.days.value"
          :series="bedtimeSeries"
          :y-format="formatClock"
          :zoom="zoom"
          :height="230"
        />
      </ChartCard>
    </section>
  </div>
</template>
