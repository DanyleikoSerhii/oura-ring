<script setup lang="ts">
const model = defineModel<number>({ required: true })

/** 0 — вся история. */
const OPTIONS = [
  { value: 30, label: '30 дней' },
  { value: 90, label: '90 дней' },
  { value: 365, label: 'Год' },
  { value: 0, label: 'Всё' },
]
</script>

<template>
  <div class="inline-flex rounded-lg border border-line bg-surface p-0.5 text-xs">
    <button
      v-for="o in OPTIONS"
      :key="o.value"
      type="button"
      class="rounded-md px-3 py-1.5 transition-colors"
      :class="model === o.value ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg'"
      @click="model = o.value"
    >
      {{ o.label }}
    </button>
  </div>
</template>
