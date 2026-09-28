<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDown, ArrowUp } from 'lucide-vue-next'
import { formatMetric, METRIC_BY_ID, SECTION_COLOR } from '@/metrics/registry'
import Sparkline from './Sparkline.vue'

const props = defineProps<{
  metricId: string
  value: number | null | undefined
  baseline?: number | null
  series?: (number | null)[]
}>()

const def = computed(() => METRIC_BY_ID[props.metricId]!)
const color = computed(() => SECTION_COLOR[def.value.section])

const delta = computed(() => {
  if (props.value == null || props.baseline == null) return null
  const diff = props.value - props.baseline
  const eps = Math.pow(10, -def.value.digits) / 2
  if (Math.abs(diff) < eps) return null
  const better = def.value.better
  const tone =
    better === null ? 'text-muted' : diff > 0 === (better === 'up') ? 'text-good' : 'text-bad'
  const shown = Math.abs(diff).toLocaleString('ru-RU', {
    maximumFractionDigits: def.value.asClock ? 2 : Math.max(def.value.digits, 1),
  })
  return { up: diff > 0, tone, text: shown }
})
</script>

<template>
  <div class="flex flex-col gap-1 rounded-xl border border-line bg-surface-2/60 px-4 py-3">
    <div class="flex items-center gap-2 text-xs text-muted">
      <span class="inline-block size-2 rounded-full" :style="{ background: color }" />
      {{ def.label }}
    </div>
    <div class="flex items-end justify-between gap-2">
      <div>
        <span class="text-2xl font-semibold">{{ formatMetric(def, value) }}</span>
        <span v-if="def.unit && value != null" class="ml-1 text-xs text-muted">{{ def.unit }}</span>
      </div>
      <Sparkline v-if="series" :values="series" :color="color" />
    </div>
    <div v-if="delta" class="flex items-center gap-1 text-xs" :class="delta.tone">
      <component :is="delta.up ? ArrowUp : ArrowDown" class="size-3" />
      {{ delta.text }} к норме
    </div>
    <div v-else-if="value != null && baseline != null" class="text-xs text-muted">в норме</div>
  </div>
</template>
