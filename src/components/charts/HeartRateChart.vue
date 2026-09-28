<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import './echarts'
import { axisStyle, tooltipStyle } from './echarts'
import type { HeartRatePoint } from '@/api/types'

const props = defineProps<{ points: HeartRatePoint[]; height?: number }>()

const SOURCES: Record<string, { name: string; color: string }> = {
  rest: { name: 'Покой', color: '#3dd6c6' },
  awake: { name: 'Бодрствование', color: '#ff6b81' },
  workout: { name: 'Тренировка', color: '#ff9f5a' },
  sleep: { name: 'Сон', color: '#7c83fd' },
  session: { name: 'Сессия', color: '#f5c451' },
  live: { name: 'Live', color: '#ff6b81' },
}

const option = computed(() => {
  const groups = new Map<string, [number, number][]>()
  for (const p of props.points) {
    const list = groups.get(p.source) ?? []
    list.push([new Date(p.timestamp).getTime(), p.bpm])
    groups.set(p.source, list)
  }
  return {
    animation: false,
    grid: { left: 44, right: 16, top: 28, bottom: 28 },
    legend: { top: 0, right: 0, textStyle: { color: '#8a90a2' }, icon: 'circle', itemHeight: 8 },
    tooltip: { trigger: 'item', ...tooltipStyle },
    xAxis: { type: 'time', ...axisStyle, splitLine: { show: false } },
    yAxis: { type: 'value', scale: true, ...axisStyle },
    series: [...groups.entries()].map(([source, data]) => ({
      name: SOURCES[source]?.name ?? source,
      type: 'scatter',
      symbolSize: 4,
      data,
      itemStyle: { color: SOURCES[source]?.color ?? '#8a90a2', opacity: 0.85 },
    })),
  }
})
</script>

<template>
  <VChart :option="option" autoresize :style="{ height: `${height ?? 220}px`, width: '100%' }" />
</template>
