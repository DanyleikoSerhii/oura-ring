import { computed, type Ref } from 'vue'
import { METRIC_BY_ID, SECTION_COLOR, formatMetric } from '@/metrics/registry'
import type { TrendSeries } from '@/components/charts/TrendChart.vue'
import { mean, nonNull } from '@/utils/stats'
import { rangeDays, seriesFor, type DailyTable } from './useDailyData'

/** Дни периода и построение рядов метрик для графиков. */
export function useTrend(table: Ref<DailyTable>, range: Ref<number>) {
  const days = computed(() => rangeDays(table.value, range.value))

  const values = (id: string) => seriesFor(table.value, id, days.value)

  const average = (id: string) => mean(nonNull(values(id)))

  const series = (id: string, type: 'line' | 'bar' = 'line'): TrendSeries[] => {
    const def = METRIC_BY_ID[id]!
    return [
      {
        name: def.label,
        color: SECTION_COLOR[def.section],
        data: values(id),
        type,
        unit: def.unit,
        format: (v) => formatMetric(def, v),
      },
    ]
  }

  return { days, values, average, series }
}
