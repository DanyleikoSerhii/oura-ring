<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import './echarts'
import { axisStyle, tooltipStyle } from './echarts'

const props = defineProps<{ phases: string; start: string; height?: number }>()

// 1 — глубокий, 2 — лёгкий, 3 — REM, 4 — бодрствование
const LEVELS = [
  { code: '4', name: 'Бодрствование', color: '#ff6b81' },
  { code: '3', name: 'REM', color: '#3dd6c6' },
  { code: '2', name: 'Лёгкий', color: '#7c83fd' },
  { code: '1', name: 'Глубокий', color: '#4b3fd6' },
]
const STEP_MS = 5 * 60 * 1000

const option = computed(() => {
  const t0 = new Date(props.start).getTime()
  const runs: { code: string; from: number; to: number }[] = []
  for (let i = 0; i < props.phases.length; i++) {
    const code = props.phases[i]!
    const last = runs[runs.length - 1]
    if (last && last.code === code) last.to = t0 + (i + 1) * STEP_MS
    else runs.push({ code, from: t0 + i * STEP_MS, to: t0 + (i + 1) * STEP_MS })
  }
  const rank = (code: string) => LEVELS.findIndex((l) => l.code === code)
  return {
    animation: false,
    grid: { left: 96, right: 16, top: 8, bottom: 28 },
    tooltip: {
      ...tooltipStyle,
      formatter: (p: { data: { value: number[] } }) => {
        const [r, from, to] = p.data.value as [number, number, number]
        const fmt = (t: number) =>
          new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
        return `${LEVELS[r]!.name}<br/>${fmt(from)} – ${fmt(to)} (${Math.round((to - from) / 60000)} мин)`
      },
    },
    xAxis: {
      type: 'time',
      min: t0,
      max: t0 + props.phases.length * STEP_MS,
      ...axisStyle,
      splitLine: { show: false },
    },
    yAxis: {
      type: 'category',
      data: LEVELS.map((l) => l.name),
      inverse: true,
      ...axisStyle,
      splitLine: { show: false },
      axisLabel: { color: '#8a90a2', fontSize: 12 },
    },
    series: [
      {
        type: 'custom',
        renderItem: (params: unknown, api: any) => {
          const r = api.value(0)
          const start = api.coord([api.value(1), r])
          const end = api.coord([api.value(2), r])
          const h = api.size([0, 1])[1] * 0.62
          return {
            type: 'rect',
            shape: {
              x: start[0],
              y: start[1] - h / 2,
              width: Math.max(1, end[0] - start[0]),
              height: h,
            },
            style: { fill: LEVELS[r]!.color },
          }
        },
        encode: { x: [1, 2], y: 0 },
        data: runs
          .filter((r) => rank(r.code) >= 0)
          .map((r) => ({ value: [rank(r.code), r.from, r.to] })),
      },
    ],
  }
})
</script>

<template>
  <VChart :option="option" autoresize :style="{ height: `${height ?? 200}px`, width: '100%' }" />
</template>
