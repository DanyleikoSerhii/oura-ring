<script setup lang="ts">
import { computed, ref } from 'vue'
import { addDays, format, parseISO } from 'date-fns'
import ScatterWithTrend from '@/components/charts/ScatterWithTrend.vue'
import ChartCard from '@/components/ui/ChartCard.vue'
import PeriodSelect from '@/components/ui/PeriodSelect.vue'
import { metricValue, rangeDays, useDailyData } from '@/composables/useDailyData'
import { formatMetric, METRICS, METRIC_BY_ID } from '@/metrics/registry'
import { pearson } from '@/utils/stats'

const FMT = 'yyyy-MM-dd'
const { table, loading } = useDailyData()

const x = ref('bedtime')
const y = ref('hrv')
/** Сдвиг Y относительно X в днях: 0 — тот же день, 1 — следующий. */
const shift = ref(1)
const range = ref(0)

const PRESETS: { x: string; y: string; shift: number; label: string }[] = [
  { x: 'bedtime', y: 'hrv', shift: 1, label: 'Отбой → HRV следующей ночи' },
  { x: 'steps', y: 'sleep_score', shift: 1, label: 'Шаги → сон следующей ночи' },
  { x: 'sleep_hours', y: 'readiness_score', shift: 1, label: 'Сон → готовность' },
  { x: 'stress_min', y: 'rhr', shift: 1, label: 'Стресс → пульс в покое' },
  { x: 'hrv', y: 'readiness_score', shift: 0, label: 'HRV → готовность' },
]
const apply = (p: (typeof PRESETS)[number]) => {
  x.value = p.x
  y.value = p.y
  shift.value = p.shift
}

const pairs = computed(() => {
  const days = rangeDays(table.value, range.value)
  const out: { x: number; y: number; day: string }[] = []
  for (const day of days) {
    const xv = metricValue(table.value, x.value, day)
    const yv = metricValue(table.value, y.value, format(addDays(parseISO(day), shift.value), FMT))
    if (xv != null && yv != null) out.push({ x: xv, y: yv, day })
  }
  return out
})

const result = computed(() =>
  pearson(
    pairs.value.map((p) => p.x),
    pairs.value.map((p) => p.y),
  ),
)

const verdict = computed(() => {
  const r = result.value
  if (!r) return { text: 'Недостаточно данных для расчёта.', tone: 'text-muted' }
  const abs = Math.abs(r.r)
  const dir = r.r > 0 ? 'прямая' : 'обратная'
  if (r.n < 30) return { text: `Слишком мало дней (${r.n}) — вывод ненадёжен.`, tone: 'text-ok' }
  if (abs < 0.2 || r.p >= 0.05)
    return {
      text: 'Связь слабая или статистически незначимая — скорее всего, шум.',
      tone: 'text-muted',
    }
  const strength = abs >= 0.6 ? 'сильная' : abs >= 0.4 ? 'заметная' : 'умеренная'
  return {
    text: `${strength[0]!.toUpperCase()}${strength.slice(1)} ${dir} связь.`,
    tone: 'text-good',
  }
})

const defX = computed(() => METRIC_BY_ID[x.value]!)
const defY = computed(() => METRIC_BY_ID[y.value]!)
const axisName = (def: (typeof METRICS)[number]) =>
  def.unit ? `${def.label}, ${def.unit}` : def.label
const formatP = (p: number) => (p < 0.001 ? '< 0.001' : p.toFixed(3))
</script>

<template>
  <div class="flex flex-col gap-5">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-semibold">Корреляции</h1>
      <PeriodSelect v-model="range" />
    </header>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="p in PRESETS"
        :key="p.label"
        type="button"
        class="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-muted hover:text-fg"
        @click="apply(p)"
      >
        {{ p.label }}
      </button>
    </div>

    <div
      class="grid grid-cols-1 gap-4 rounded-2xl border border-line bg-surface p-5 text-sm md:grid-cols-3"
    >
      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted">Метрика X (причина?)</span>
        <select v-model="x" class="rounded-md border border-line bg-surface-2 px-2 py-2">
          <option v-for="m in METRICS" :key="m.id" :value="m.id">{{ m.label }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted">Метрика Y (следствие?)</span>
        <select v-model="y" class="rounded-md border border-line bg-surface-2 px-2 py-2">
          <option v-for="m in METRICS" :key="m.id" :value="m.id">{{ m.label }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted">Сдвиг Y относительно X</span>
        <select v-model.number="shift" class="rounded-md border border-line bg-surface-2 px-2 py-2">
          <option :value="0">Тот же день</option>
          <option :value="1">Следующий день</option>
          <option :value="2">Через 2 дня</option>
        </select>
      </label>
    </div>

    <section class="grid grid-cols-12 gap-5">
      <ChartCard
        class="col-span-12 xl:col-span-8"
        title="Диаграмма рассеяния"
        :loading="loading"
        :empty="pairs.length < 3"
        empty-text="Слишком мало общих дней для этой пары"
      >
        <ScatterWithTrend
          :points="pairs"
          :x-name="axisName(defX)"
          :y-name="axisName(defY)"
          :slope="result?.slope"
          :intercept="result?.intercept"
          :x-format="(v) => formatMetric(defX, v)"
          :y-format="(v) => formatMetric(defY, v)"
          :height="380"
        />
      </ChartCard>
      <ChartCard class="col-span-12 xl:col-span-4" title="Результат" :empty="false">
        <dl v-if="result" class="grid grid-cols-3 gap-3 text-center">
          <div class="rounded-xl bg-surface-2/60 p-3">
            <dt class="text-xs text-muted">r</dt>
            <dd class="text-2xl font-semibold">{{ result.r.toFixed(2) }}</dd>
          </div>
          <div class="rounded-xl bg-surface-2/60 p-3">
            <dt class="text-xs text-muted">Дней</dt>
            <dd class="text-2xl font-semibold">{{ result.n }}</dd>
          </div>
          <div class="rounded-xl bg-surface-2/60 p-3">
            <dt class="text-xs text-muted">p</dt>
            <dd class="text-xl font-semibold whitespace-nowrap">{{ formatP(result.p) }}</dd>
          </div>
        </dl>
        <p class="mt-4 text-sm" :class="verdict.tone">{{ verdict.text }}</p>
        <p class="mt-4 border-t border-line pt-3 text-xs text-muted">
          Корреляция не доказывает причинность. На данных одного человека легко увидеть связь,
          которой нет: смотрите на число дней и p-value, а не только на r.
        </p>
      </ChartCard>
    </section>
  </div>
</template>
