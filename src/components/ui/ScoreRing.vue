<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  value: number | null | undefined
  label: string
  color: string
  size?: number
}>()

const size = computed(() => props.size ?? 132)
const stroke = 10
const radius = computed(() => (size.value - stroke) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const offset = computed(
  () => circumference.value * (1 - Math.min(100, Math.max(0, props.value ?? 0)) / 100),
)

const status = computed(() => {
  const v = props.value
  if (v == null) return { text: 'Нет данных', cls: 'text-muted' }
  if (v >= 85) return { text: 'Оптимально', cls: 'text-good' }
  if (v >= 70) return { text: 'Хорошо', cls: 'text-ok' }
  return { text: 'Обратить внимание', cls: 'text-bad' }
})
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <div class="relative" :style="{ width: `${size}px`, height: `${size}px` }">
      <svg :width="size" :height="size" class="-rotate-90">
        <circle
          :cx="size / 2"
          :cy="size / 2"
          :r="radius"
          fill="none"
          stroke="var(--color-line)"
          :stroke-width="stroke"
        />
        <circle
          :cx="size / 2"
          :cy="size / 2"
          :r="radius"
          fill="none"
          :stroke="color"
          :stroke-width="stroke"
          stroke-linecap="round"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="offset"
          class="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div class="absolute inset-0 flex items-center justify-center">
        <span class="text-5xl font-semibold leading-none">{{ value ?? '—' }}</span>
      </div>
    </div>
    <div class="text-center">
      <div class="text-sm font-medium">{{ label }}</div>
      <div class="text-xs" :class="status.cls">{{ status.text }}</div>
    </div>
  </div>
</template>
