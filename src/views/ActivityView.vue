<script setup lang="ts">
import { computed, toRef } from 'vue'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import TrendChart from '@/components/charts/TrendChart.vue'
import ChartCard from '@/components/ui/ChartCard.vue'
import MetricTile from '@/components/ui/MetricTile.vue'
import PeriodSelect from '@/components/ui/PeriodSelect.vue'
import { useDailyData } from '@/composables/useDailyData'
import { useTrend } from '@/composables/useTrend'
import { SECTION_COLOR } from '@/metrics/registry'
import { useDayStore } from '@/stores/period'

const store = useDayStore()
const { table, loading } = useDailyData()
const trend = useTrend(table, toRef(store, 'range'))

const AVERAGES = ['steps', 'active_cal', 'high_min', 'medium_min', 'sedentary_h', 'activity_score']

const intensity = computed(() => [
  { name: 'Высокая', color: '#ff6b81', data: trend.values('high_min'), unit: 'мин' },
  { name: 'Средняя', color: SECTION_COLOR.activity, data: trend.values('medium_min'), unit: 'мин' },
])
const zoom = computed(() => trend.days.value.length > 120)

const workouts = computed(() => {
  const set = new Set(trend.days.value)
  return [...table.value.byDay.values()]
    .filter((d) => set.has(d.day))
    .flatMap((d) => d.workouts)
    .sort((a, b) => b.start_datetime.localeCompare(a.start_datetime))
    .slice(0, 30)
})
const minutes = (w: { start_datetime: string; end_datetime: string }) =>
  Math.round((Date.parse(w.end_datetime) - Date.parse(w.start_datetime)) / 60000)
</script>

<template>
  <div class="flex flex-col gap-5">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-semibold">Активность</h1>
      <PeriodSelect v-model="store.range" />
    </header>

    <p class="-mb-2 text-xs text-muted">Средние значения за выбранный период</p>
    <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <MetricTile v-for="id in AVERAGES" :key="id" :metric-id="id" :value="trend.average(id)" />
    </div>

    <section class="grid grid-cols-12 gap-5">
      <ChartCard
        class="col-span-12 xl:col-span-6"
        title="Шаги"
        :loading="loading"
        :empty="!trend.days.value.length"
      >
        <TrendChart
          :days="trend.days.value"
          :series="trend.series('steps', 'bar')"
          :zoom="zoom"
          :height="240"
        />
      </ChartCard>
      <ChartCard
        class="col-span-12 xl:col-span-6"
        title="Активные калории"
        :empty="!trend.days.value.length"
      >
        <TrendChart
          :days="trend.days.value"
          :series="trend.series('active_cal', 'bar')"
          :zoom="zoom"
          :height="240"
        />
      </ChartCard>
      <ChartCard
        class="col-span-12 xl:col-span-6"
        title="Интенсивность, мин"
        :empty="!trend.days.value.length"
      >
        <TrendChart :days="trend.days.value" :series="intensity" :zoom="zoom" :height="240" />
      </ChartCard>
      <ChartCard
        class="col-span-12 xl:col-span-6"
        title="Оценка активности"
        :empty="!trend.days.value.length"
      >
        <TrendChart
          :days="trend.days.value"
          :series="trend.series('activity_score')"
          :zoom="zoom"
          :height="240"
        />
      </ChartCard>
    </section>

    <ChartCard
      title="Тренировки"
      subtitle="Последние 30 за период"
      :empty="!workouts.length"
      empty-text="Тренировок за период нет"
    >
      <table class="w-full text-sm">
        <thead class="text-left text-xs text-muted">
          <tr>
            <th class="py-2 font-normal">Дата</th>
            <th class="font-normal">Тип</th>
            <th class="font-normal">Длительность</th>
            <th class="font-normal">Калории</th>
            <th class="font-normal">Интенсивность</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in workouts" :key="w.id" class="border-t border-line">
            <td class="py-2">{{ format(parseISO(w.day), 'd MMM yyyy', { locale: ru }) }}</td>
            <td>{{ w.label || w.activity }}</td>
            <td>{{ minutes(w) }} мин</td>
            <td>{{ w.calories ? Math.round(w.calories) : '—' }}</td>
            <td class="text-muted">{{ w.intensity ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
    </ChartCard>
  </div>
</template>
