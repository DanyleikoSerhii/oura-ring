<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  empty?: boolean
  emptyText?: string
  loading?: boolean
}>()
</script>

<template>
  <section class="flex min-h-0 flex-col rounded-2xl border border-line bg-surface p-5">
    <header class="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold">{{ title }}</h2>
        <p v-if="subtitle" class="mt-0.5 text-xs text-muted">{{ subtitle }}</p>
      </div>
      <slot name="actions" />
    </header>
    <div
      v-if="loading"
      class="flex-1 animate-pulse rounded-lg bg-surface-2"
      style="min-height: 120px"
    />
    <div
      v-else-if="empty"
      class="flex flex-1 items-center justify-center text-sm text-muted"
      style="min-height: 120px"
    >
      {{ emptyText ?? 'Нет данных за выбранный период' }}
    </div>
    <div v-else class="min-h-0 flex-1"><slot /></div>
  </section>
</template>
