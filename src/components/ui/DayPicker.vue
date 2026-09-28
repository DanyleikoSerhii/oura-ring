<script setup lang="ts">
import { computed } from 'vue'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { useDayStore } from '@/stores/period'

const store = useDayStore()
const label = computed(() => {
  const text = format(parseISO(store.day), 'EEEE, d MMMM yyyy', { locale: ru })
  return text.charAt(0).toUpperCase() + text.slice(1)
})
</script>

<template>
  <div class="flex items-center gap-1">
    <button
      type="button"
      class="rounded-lg border border-line bg-surface p-2 text-muted hover:text-fg"
      aria-label="Предыдущий день"
      @click="store.shift(-1)"
    >
      <ChevronLeft class="size-4" />
    </button>
    <span class="min-w-56 px-3 text-center text-sm font-medium">{{ label }}</span>
    <button
      type="button"
      class="rounded-lg border border-line bg-surface p-2 text-muted hover:text-fg disabled:opacity-30"
      aria-label="Следующий день"
      :disabled="store.isToday"
      @click="store.shift(1)"
    >
      <ChevronRight class="size-4" />
    </button>
  </div>
</template>
