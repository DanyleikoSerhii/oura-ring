<script setup lang="ts">
import { computed, toRef } from 'vue'
import TrendChart from '@/components/charts/TrendChart.vue'
import ChartCard from '@/components/ui/ChartCard.vue'
import ContributorBar from '@/components/ui/ContributorBar.vue'
import DayPicker from '@/components/ui/DayPicker.vue'
import MetricTile from '@/components/ui/MetricTile.vue'
import PeriodSelect from '@/components/ui/PeriodSelect.vue'
import ScoreRing from '@/components/ui/ScoreRing.vue'
import { baselineFor, metricValue, useDailyData } from '@/composables/useDailyData'
import { useTrend } from '@/composables/useTrend'
import { READINESS_CONTRIBUTORS, SECTION_COLOR } from '@/metrics/registry'
import { useDayStore } from '@/stores/period'

const store = useDayStore()
const { table, loading } = useDailyData()
const trend = useTrend(table, toRef(store, 'range'))
const bundle = computed(() => table.value.byDay.get(store.day))
const zoom = computed(() => trend.days.value.length > 120)

const TILES = ['hrv', 'rhr', 'temp_dev', 'spo2', 'stress_min', 'recovery_min']
const tiles = computed(() =>
  TILES.map((id) => ({
    id,
    value: metricValue(table.value, id, store.day),
    baseline: baselineFor(table.value, id, store.day),
  })),
)

const contributors = computed(() => {
  const c = bundle.value?.readiness?.contributors as Record<string, number | null> | undefined
  return READINESS_CONTRIBUTORS.map(([key, label]) => ({ label, value: c?.[key] }))
})

const RESILIENCE: Record<string, string> = {
  limited: 'Ограниченная',
  adequate: 'Достаточная',
  solid: 'Устойчивая',
  strong: 'Высокая',
  exceptional: 'Исключительная',
}
const resilience = computed(() => {
  const r = bundle.value?.resilience
  return r?.level ? (RESILIENCE[r.level] ?? r.level) : null
})

const stress = computed(() => [
  { name: 'Стресс', color: '#ff6b6b', data: trend.values('stress_min'), unit: 'мин' },
  {
    name: 'Восстановление',
    color: SECTION_COLOR.readiness,
    data: trend.values('recovery_min'),
    unit: 'мин',
  },
])
</script>

<template>
  <div class="flex flex-col gap-5">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-semibold">Восстановление</h1>
      <DayPicker />
    </header>

    <section class="grid grid-cols-12 gap-5">
      <div
        class="col-span-12 flex items-center justify-center rounded-2xl border border-line bg-surface p-5 md:col-span-4 xl:col-span-3"
      >
        <ScoreRing
          label="Готовность"
          :value="bundle?.readiness?.score"
          :color="SECTION_COLOR.readiness"
        />
      </div>
      <ChartCard
        class="col-span-12 md:col-span-8 xl:col-span-4"
        title="Вклады в готовность"
        :loading="loading"
        :empty="!bundle?.readiness"
      >
        <div class="flex flex-col gap-3">
          <ContributorBar
            v-for="c in contributors"
            :key="c.label"
            :label="c.label"
            :value="c.value"
            :color="SECTION_COLOR.readiness"
          />
        </div>
      </ChartCard>
      <div class="col-span-12 grid grid-cols-2 content-start gap-3 md:grid-cols-3 xl:col-span-5">
        <MetricTile
          v-for="t in tiles"
          :key="t.id"
          :metric-id="t.id"
          :value="t.value"
          :baseline="t.baseline"
        />
        <div
          v-if="resilience"
          class="col-span-full rounded-xl border border-line bg-surface-2/60 px-4 py-3 text-sm"
        >
          <span class="text-xs text-muted">Устойчивость: </span>{{ resilience }}
        </div>
      </div>
    </section>

    <div class="flex items-center justify-between">
      <h2 class="text-base font-semibold">Тренды</h2>
      <PeriodSelect v-model="store.range" />
    </div>

    <section class="grid grid-cols-12 gap-5">
      <ChartCard
        class="col-span-12 xl:col-span-6"
        title="Готовность"
        :empty="!trend.days.value.length"
      >
        <TrendChart
          :days="trend.days.value"
          :series="trend.series('readiness_score')"
          :zoom="zoom"
          :height="230"
        />
      </ChartCard>
      <ChartCard
        class="col-span-12 xl:col-span-6"
        title="HRV, мс"
        :empty="!trend.days.value.length"
      >
        <TrendChart
          :days="trend.days.value"
          :series="trend.series('hrv')"
          :zoom="zoom"
          :height="230"
        />
      </ChartCard>
      <ChartCard
        class="col-span-12 xl:col-span-6"
        title="Пульс в покое, уд/мин"
        :empty="!trend.days.value.length"
      >
        <TrendChart
          :days="trend.days.value"
          :series="trend.series('rhr')"
          :zoom="zoom"
          :height="230"
        />
      </ChartCard>
      <ChartCard
        class="col-span-12 xl:col-span-6"
        title="Отклонение температуры, °C"
        :empty="!trend.days.value.length"
      >
        <TrendChart
          :days="trend.days.value"
          :series="trend.series('temp_dev')"
          :zoom="zoom"
          :height="230"
        />
      </ChartCard>
      <ChartCard
        class="col-span-12 xl:col-span-6"
        title="Стресс и восстановление, мин"
        :empty="!trend.days.value.length"
      >
        <TrendChart :days="trend.days.value" :series="stress" :zoom="zoom" :height="230" />
      </ChartCard>
      <ChartCard
        class="col-span-12 xl:col-span-6"
        title="SpO2, %"
        :empty="!trend.days.value.length"
      >
        <TrendChart
          :days="trend.days.value"
          :series="trend.series('spo2')"
          :zoom="zoom"
          :height="230"
        />
      </ChartCard>
      <ChartCard
        class="col-span-12 xl:col-span-6"
        title="VO2 max"
        :empty="!trend.days.value.length"
      >
        <TrendChart
          :days="trend.days.value"
          :series="trend.series('vo2')"
          :zoom="zoom"
          :height="230"
        />
      </ChartCard>
      <ChartCard
        class="col-span-12 xl:col-span-6"
        title="Сосудистый возраст"
        :empty="!trend.days.value.length"
      >
        <TrendChart
          :days="trend.days.value"
          :series="trend.series('vascular_age')"
          :zoom="zoom"
          :height="230"
        />
      </ChartCard>
    </section>
  </div>
</template>
