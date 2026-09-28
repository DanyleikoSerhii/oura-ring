import { addDays, format, parseISO } from 'date-fns'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const FMT = 'yyyy-MM-dd'
const todayStr = () => format(new Date(), FMT)

export const useDayStore = defineStore('day', () => {
  const day = ref(todayStr())
  /** Период трендов в днях; 0 — вся история. */
  const range = ref(90)

  const shift = (delta: number) => {
    const next = format(addDays(parseISO(day.value), delta), FMT)
    if (next <= todayStr()) day.value = next
  }
  const isToday = computed(() => day.value === todayStr())
  return { day, range, shift, isToday }
})
