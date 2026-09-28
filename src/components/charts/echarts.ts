import { use } from 'echarts/core'
import { BarChart, CustomChart, LineChart, ScatterChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([
  BarChart,
  CustomChart,
  LineChart,
  ScatterChart,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
])

export const chartColors = {
  fg: '#e8eaf0',
  muted: '#8a90a2',
  line: '#232836',
  surface: '#151922',
  sleep: '#7c83fd',
  readiness: '#3dd6c6',
  activity: '#ff9f5a',
  heart: '#ff6b81',
}

export const axisStyle = {
  axisLine: { lineStyle: { color: chartColors.line } },
  axisTick: { show: false },
  axisLabel: { color: chartColors.muted, fontSize: 11 },
  splitLine: { lineStyle: { color: chartColors.line, type: 'dashed' as const } },
}

export const tooltipStyle = {
  backgroundColor: '#1b202b',
  borderColor: '#232836',
  textStyle: { color: chartColors.fg, fontSize: 12 },
}
