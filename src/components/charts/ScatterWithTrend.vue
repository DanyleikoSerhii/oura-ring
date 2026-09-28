<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import './echarts'
import { axisStyle, tooltipStyle } from './echarts'

const props = defineProps<{
  points: { x: number; y: number; day: string }[]
  xName: string
  yName: string
  slope?: number
  intercept?: number
  xFormat?: (v: number) => string
  yFormat?: (v: number) => string
  height?: number
}>()

const option = computed(() => {
  const xs = props.points.map((p) => p.x)
  const lo = Math.min(...xs)
  const hi = Math.max(...xs)
  const line =
    props.slope != null && props.intercept != null && xs.length
      ? [
          [lo, props.slope * lo + props.intercept],
          [hi, props.slope * hi + props.intercept],
        ]
      : []
  const fx = props.xFormat ?? ((v: number) => String(Math.round(v * 100) / 100))
  const fy = props.yFormat ?? ((v: number) => String(Math.round(v * 100) / 100))
  return {
    animation: false,
    grid: { left: 56, right: 24, top: 16, bottom: 44 },
    tooltip: {
      ...tooltipStyle,
      formatter: (p: { seriesType: string; data: { value: number[]; day: string } }) =>
        p.seriesType === 'scatter'
          ? `${p.data.day}<br/>${props.xName}: <b>${fx(p.data.value[0]!)}</b><br/>${props.yName}: <b>${fy(p.data.value[1]!)}</b>`
          : '',
    },
    xAxis: {
      type: 'value',
      scale: true,
      name: props.xName,
      nameLocation: 'middle',
      nameGap: 28,
      nameTextStyle: { color: '#8a90a2' },
      ...axisStyle,
      axisLabel: { ...axisStyle.axisLabel, formatter: (v: number) => fx(v) },
    },
    yAxis: {
      type: 'value',
      scale: true,
      name: props.yName,
      nameTextStyle: { color: '#8a90a2', align: 'left' },
      ...axisStyle,
      axisLabel: { ...axisStyle.axisLabel, formatter: (v: number) => fy(v) },
    },
    series: [
      {
        type: 'scatter',
        symbolSize: 7,
        itemStyle: { color: '#7c83fd', opacity: 0.55 },
        data: props.points.map((p) => ({ value: [p.x, p.y], day: p.day })),
      },
      {
        type: 'line',
        showSymbol: false,
        silent: true,
        lineStyle: { color: '#ff9f5a', width: 2 },
        data: line,
      },
    ],
  }
})
</script>

<template>
  <VChart :option="option" autoresize :style="{ height: `${height ?? 320}px`, width: '100%' }" />
</template>
