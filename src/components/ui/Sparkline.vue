<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  values: (number | null)[]
  color: string
  width?: number
  height?: number
}>()

const w = computed(() => props.width ?? 96)
const h = computed(() => props.height ?? 28)

const path = computed(() => {
  const pts = props.values
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => p.v != null)
  if (pts.length < 2) return ''
  const lo = Math.min(...pts.map((p) => p.v))
  const hi = Math.max(...pts.map((p) => p.v))
  const span = hi - lo || 1
  const last = props.values.length - 1 || 1
  return pts
    .map(
      (p, k) =>
        `${k === 0 ? 'M' : 'L'}${((p.i / last) * (w.value - 2) + 1).toFixed(1)},${(
          h.value -
          2 -
          ((p.v - lo) / span) * (h.value - 4)
        ).toFixed(1)}`,
    )
    .join(' ')
})
</script>

<template>
  <svg :width="w" :height="h" :viewBox="`0 0 ${w} ${h}`" class="overflow-visible">
    <path
      v-if="path"
      :d="path"
      fill="none"
      :stroke="color"
      stroke-width="1.6"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
  </svg>
</template>
