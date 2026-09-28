<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { HeartRatePoint } from '@/api/types'
import ChartCard from '@/components/ui/ChartCard.vue'
import ContributorBar from '@/components/ui/ContributorBar.vue'
import DayPicker from '@/components/ui/DayPicker.vue'
import MetricTile from '@/components/ui/MetricTile.vue'
import ScoreRing from '@/components/ui/ScoreRing.vue'
import Hypnogram from '@/components/charts/Hypnogram.vue'
import HeartRateChart from '@/components/charts/HeartRateChart.vue'
import TrendChart from '@/components/charts/TrendChart.vue'
import {
  baselineFor,
  lastNDays,
  metricValue,
  seriesFor,
  useDailyData,
} from '@/composables/useDailyData'
import { loadHeartDay } from '@/db/sync'
import { formatDuration, formatMetric, METRIC_BY_ID, SECTION_COLOR } from '@/metrics/registry'
import { useDayStore } from '@/stores/period'
import { useSyncStore } from '@/stores/sync'

const store = useDayStore()
const sync = useSyncStore()
const { table, loading } = useDailyData()

const hasData = computed(() => table.value.days.length > 0)
const bundle = computed(() => table.value.byDay.get(store.day))

// Если за сегодня данных ещё нет (сон обрабатывается утром), показываем последний день с данными.
const initialized = ref(false)
watch(
  table,
  (t) => {
    if (initialized.value || !t.days.length) return
    initialized.value = true
    if (!t.byDay.has(store.day)) store.day = t.days[t.days.length - 1]!
  },
  { immediate: true },
)

const TILES = ['rhr', 'hrv', 'temp_dev', 'steps', 'spo2', 'stress_min']
const window30 = computed(() => lastNDays(table.value, store.day, 30))

const tiles = computed(() =>
  TILES.map((id) => ({
    id,
    value: metricValue(table.value, id, store.day),
    baseline: baselineFor(table.value, id, store.day),
    series: seriesFor(table.value, id, window30.value),
  })),
)

// Сон
const sleep = computed(() => bundle.value?.sleep)
const phaseRows = computed(() => {
  const s = sleep.value
  if (!s) return []
  const total = s.time_in_bed || 1
  return [
    { label: 'Глубокий', sec: s.deep_sleep_duration, color: '#4b3fd6' },
    { label: 'Лёгкий', sec: s.light_sleep_duration, color: '#7c83fd' },
    { label: 'REM', sec: s.rem_sleep_duration, color: '#3dd6c6' },
    { label: 'Бодрствование', sec: s.awake_time, color: '#ff6b81' },
  ].map((r) => ({ ...r, pct: ((r.sec ?? 0) / total) * 100 }))
})
const clock = (iso?: string) => (iso ? format(parseISO(iso), 'HH:mm') : '—')

// Пульс за сутки (по запросу)
const heart = ref<HeartRatePoint[]>([])
const heartLoading = ref(false)
const heartError = ref<string | null>(null)
watch(
  () => [store.day, sync.lastSyncAt],
  async () => {
    heartLoading.value = true
    heartError.value = null
    const day = store.day
    try {
      const points = await loadHeartDay(day)
      if (day === store.day) heart.value = points
    } catch (e) {
      heart.value = []
      heartError.value = e instanceof Error ? e.message : String(e)
    } finally {
      heartLoading.value = false
    }
  },
  { immediate: true },
)

// Вклады в готовность
const CONTRIBUTORS: [string, string][] = [
  ['hrv_balance', 'Баланс HRV'],
  ['resting_heart_rate', 'Пульс в покое'],
  ['recovery_index', 'Индекс восстановления'],
  ['previous_night', 'Прошлая ночь'],
  ['sleep_balance', 'Баланс сна'],
  ['previous_day_activity', 'Активность вчера'],
  ['activity_balance', 'Баланс активности'],
  ['body_temperature', 'Температура тела'],
]
const contributors = computed(() => {
  const c = bundle.value?.readiness?.contributors as Record<string, number | null> | undefined
  return CONTRIBUTORS.map(([key, label]) => ({ label, value: c?.[key] }))
})

// Активность
const activity = computed(() => bundle.value?.activity)
const activityRows = computed(() => {
  const a = activity.value
  if (!a) return []
  return [
    { label: 'Высокая', sec: a.high_activity_time },
    { label: 'Средняя', sec: a.medium_activity_time },
    { label: 'Низкая', sec: a.low_activity_time },
  ]
})

// Мини-тренды за 30 дней
const trendDays = computed(() => window30.value)
const shortDays = computed(() =>
  trendDays.value.map((d) => format(parseISO(d), 'd MMM', { locale: ru })),
)
const trend = (id: string) => seriesFor(table.value, id, trendDays.value)
const scoreSeries = computed(() => [
  { name: 'Готовность', color: SECTION_COLOR.readiness, data: trend('readiness_score') },
  { name: 'Сон', color: SECTION_COLOR.sleep, data: trend('sleep_score') },
  { name: 'Активность', color: SECTION_COLOR.activity, data: trend('activity_score') },
])
const single = (id: string) => [
  {
    name: METRIC_BY_ID[id]!.label,
    color: SECTION_COLOR[METRIC_BY_ID[id]!.section],
    data: trend(id),
    unit: METRIC_BY_ID[id]!.unit,
  },
]
</script>

<template>
  <div class="flex flex-col gap-5">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-semibold">Дашборд</h1>
      <DayPicker />
    </header>

    <div
      v-if="!loading && !hasData"
      class="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-12 text-center"
    >
      <p class="text-lg font-medium">Данных пока нет</p>
      <p class="max-w-md text-sm text-muted">
        Запустите синхронизацию, чтобы загрузить историю из Oura. Токен должен лежать в
        <code>.env.local</code> (см. <code>.env.example</code>).
      </p>
      <RouterLink to="/sync" class="rounded-lg bg-sleep px-4 py-2 text-sm font-medium text-bg">
        Открыть синхронизацию
      </RouterLink>
    </div>

    <template v-else>
      <section class="grid grid-cols-12 gap-5">
        <div
          class="col-span-12 flex flex-wrap items-center justify-around gap-6 rounded-2xl border border-line bg-surface p-5 xl:col-span-5"
        >
          <ScoreRing
            label="Готовность"
            :value="bundle?.readiness?.score"
            :color="SECTION_COLOR.readiness"
          />
          <ScoreRing label="Сон" :value="bundle?.dailySleep?.score" :color="SECTION_COLOR.sleep" />
          <ScoreRing
            label="Активность"
            :value="bundle?.activity?.score"
            :color="SECTION_COLOR.activity"
          />
        </div>
        <div class="col-span-12 grid grid-cols-2 gap-3 md:grid-cols-3 xl:col-span-7">
          <MetricTile
            v-for="t in tiles"
            :key="t.id"
            :metric-id="t.id"
            :value="t.value"
            :baseline="t.baseline"
            :series="t.series"
          />
        </div>
      </section>

      <section class="grid grid-cols-12 gap-5">
        <ChartCard
          class="col-span-12 xl:col-span-5"
          title="Сон"
          :subtitle="
            sleep
              ? `${clock(sleep.bedtime_start)} – ${clock(sleep.bedtime_end)} · ${formatDuration(sleep.total_sleep_duration)}`
              : undefined
          "
          :empty="!sleep"
          empty-text="Нет данных о сне за этот день"
        >
          <Hypnogram
            v-if="sleep?.sleep_phase_5_min"
            :phases="sleep.sleep_phase_5_min"
            :start="sleep.bedtime_start"
            :height="170"
          />
          <ul class="mt-2 grid grid-cols-2 gap-x-6 gap-y-2">
            <li v-for="r in phaseRows" :key="r.label" class="text-xs">
              <div class="flex justify-between">
                <span class="text-muted">{{ r.label }}</span>
                <span class="font-medium">{{ formatDuration(r.sec) }}</span>
              </div>
              <div class="mt-1 h-1 overflow-hidden rounded-full bg-line">
                <div
                  class="h-full rounded-full"
                  :style="{ width: `${r.pct}%`, background: r.color }"
                />
              </div>
            </li>
          </ul>
        </ChartCard>

        <ChartCard
          class="col-span-12 xl:col-span-4"
          title="Пульс за сутки"
          :loading="heartLoading && !heart.length"
          :empty="!heartLoading && !heart.length"
          :empty-text="heartError ?? 'Нет данных о пульсе за этот день'"
        >
          <HeartRateChart :points="heart" :height="230" />
        </ChartCard>

        <ChartCard
          class="col-span-12 xl:col-span-3"
          title="Что влияет на готовность"
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
      </section>

      <section class="grid grid-cols-12 gap-5">
        <ChartCard class="col-span-12 xl:col-span-3" title="Активность" :empty="!activity">
          <dl v-if="activity" class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt class="text-xs text-muted">Шаги</dt>
              <dd class="text-xl font-semibold">
                {{ formatMetric(METRIC_BY_ID.steps!, activity.steps) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">Активные ккал</dt>
              <dd class="text-xl font-semibold">
                {{ formatMetric(METRIC_BY_ID.active_cal!, activity.active_calories) }}
              </dd>
            </div>
            <div v-for="r in activityRows" :key="r.label" class="col-span-1">
              <dt class="text-xs text-muted">{{ r.label }}</dt>
              <dd class="font-medium">{{ formatDuration(r.sec) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted">Сидячее время</dt>
              <dd class="font-medium">{{ formatDuration(activity.sedentary_time) }}</dd>
            </div>
          </dl>
          <ul
            v-if="bundle?.workouts.length"
            class="mt-4 flex flex-col gap-1 border-t border-line pt-3 text-xs"
          >
            <li v-for="w in bundle.workouts" :key="w.id" class="flex justify-between">
              <span>{{ w.label || w.activity }}</span>
              <span class="text-muted">{{
                w.calories ? `${Math.round(w.calories)} ккал` : ''
              }}</span>
            </li>
          </ul>
        </ChartCard>

        <ChartCard
          class="col-span-12 xl:col-span-9"
          title="Оценки за 30 дней"
          :empty="!trendDays.length"
        >
          <TrendChart
            :days="trendDays"
            :categories="shortDays"
            :series="scoreSeries"
            :height="200"
          />
        </ChartCard>
      </section>

      <section class="grid grid-cols-12 gap-5">
        <ChartCard
          class="col-span-12 md:col-span-6 xl:col-span-4"
          title="HRV за 30 дней"
          :empty="!trendDays.length"
        >
          <TrendChart
            :days="trendDays"
            :categories="shortDays"
            :series="single('hrv')"
            :height="150"
          />
        </ChartCard>
        <ChartCard
          class="col-span-12 md:col-span-6 xl:col-span-4"
          title="Пульс в покое за 30 дней"
          :empty="!trendDays.length"
        >
          <TrendChart
            :days="trendDays"
            :categories="shortDays"
            :series="single('rhr')"
            :height="150"
          />
        </ChartCard>
        <ChartCard
          class="col-span-12 md:col-span-6 xl:col-span-4"
          title="Шаги за 30 дней"
          :empty="!trendDays.length"
        >
          <TrendChart
            :days="trendDays"
            :categories="shortDays"
            :series="[{ ...single('steps')[0]!, type: 'bar' }]"
            :height="150"
          />
        </ChartCard>
      </section>
    </template>
  </div>
</template>
