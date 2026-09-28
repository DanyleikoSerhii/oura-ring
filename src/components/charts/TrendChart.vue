<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import './echarts'
import { axisStyle, tooltipStyle } from './echarts'

export interface TrendSeries {
  name: string
  color: string
  data: (number | null)[]
  type?: 'line' | 'bar'
  unit?: string
  /** Форматирование значения в подсказке. */
  format?: (v: number) => string
  dashed?: boolean
  /** Серии с одинаковым ключом складываются в столбик. */
  stack?: string
}

const props = defineProps<{
  days: string[]
  series: TrendSeries[]
  height?: number
  zoom?: boolean
  yMin?: number | 'dataMin'
  yFormat?: (v: number) => string
  /** Категории вместо дат на оси X (например, дни периода 1..7). */
  categories?: string[]
}>()

const option = computed(() => ({
  animation: false,
  grid: {
    left: 44,
    right: 16,
    top: props.series.length > 1 ? 32 : 16,
    bottom: props.zoom ? 56 : 28,
  },
  legend:
    props.series.length > 1
      ? { top: 0, right: 0, textStyle: { color: '#8a90a2' }, icon: 'roundRect', itemHeight: 8 }
      : undefined,
  tooltip: {
    trigger: 'axis',
    ...tooltipStyle,
    valueFormatter: undefined,
    formatter: (
      params: {
        seriesName: string
        value: number | null
        marker: string
        axisValueLabel: string
      }[],
    ) => {
      const rows = params
        .map((p) => {
          const s = props.series.find((x) => x.name === p.seriesName)
          const v = p.value == null ? '—' : s?.format ? s.format(p.value) : String(p.value)
          return `${p.marker}${p.seriesName}: <b>${v}</b> ${p.value != null ? (s?.unit ?? '') : ''}`
        })
        .join('<br/>')
      return `${params[0]?.axisValueLabel ?? ''}<br/>${rows}`
    },
  },
  xAxis: {
    type: 'category',
    data: props.categories ?? props.days,
    boundaryGap: props.series.some((s) => s.type === 'bar'),
    ...axisStyle,
    splitLine: { show: false },
  },
  yAxis: {
    type: 'value',
    scale: !props.series.some((s) => s.type === 'bar'),
    min: props.yMin,
    ...axisStyle,
    axisLabel: { ...axisStyle.axisLabel, formatter: props.yFormat },
  },
  dataZoom: props.zoom
    ? [
        { type: 'inside' },
        {
          type: 'slider',
          height: 18,
          bottom: 8,
          borderColor: '#232836',
          fillerColor: 'rgba(124,131,253,0.15)',
          textStyle: { color: '#8a90a2' },
        },
      ]
    : undefined,
  series: props.series.map((s) => ({
    name: s.name,
    type: s.type ?? 'line',
    stack: s.stack,
    data: s.data,
    smooth: s.type !== 'bar' ? 0.25 : undefined,
    showSymbol: false,
    connectNulls: true,
    lineStyle: { color: s.color, width: 2, type: s.dashed ? 'dashed' : 'solid' },
    itemStyle: { color: s.color, borderRadius: s.type === 'bar' ? [3, 3, 0, 0] : undefined },
    areaStyle:
      s.type !== 'bar' && props.series.length === 1 ? { color: s.color, opacity: 0.08 } : undefined,
  })),
}))
</script>

<template>
  <VChart :option="option" autoresize :style="{ height: `${height ?? 220}px`, width: '100%' }" />
</template>
