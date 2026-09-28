<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ label: string; value: number | null | undefined; color: string }>()
const width = computed(() => `${Math.min(100, Math.max(0, props.value ?? 0))}%`)
</script>

<template>
  <div class="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
    <span class="text-xs text-muted">{{ label }}</span>
    <span class="text-xs font-medium">{{ value ?? '—' }}</span>
    <div class="col-span-2 h-1.5 overflow-hidden rounded-full bg-line">
      <div
        class="h-full rounded-full transition-[width] duration-500"
        :style="{ width, background: color }"
      />
    </div>
  </div>
</template>
