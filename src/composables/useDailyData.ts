import { computed, type ComputedRef, type Ref } from 'vue'
import type { SleepSession } from '@/api/types'
import { db } from '@/db/schema'
import { METRIC_BY_ID, type DayBundle } from '@/metrics/registry'
import { median, nonNull } from '@/utils/stats'
import { useLive } from './useLive'

export interface DailyTable {
  days: string[]
  byDay: Map<string, DayBundle>
}

const EMPTY: DailyTable = { days: [], byDay: new Map() }

function mainSleep(all: SleepSession[]): SleepSession | undefined {
  // Удалённые пользователем и отклонённые (ложные) сессии не учитываем.
  const sessions = all.filter((s) => s.type !== 'deleted' && s.type !== 'rest')
  const long = sessions.filter((s) => s.type === 'long_sleep')
  const pool = long.length ? long : sessions
  return pool.reduce<SleepSession | undefined>(
    (best, s) =>
      !best || (s.total_sleep_duration ?? 0) > (best.total_sleep_duration ?? 0) ? s : best,
    undefined,
  )
}

async function loadTable(): Promise<DailyTable> {
  const [readiness, dailySleep, sleep, activity, stress, resilience, spo2, cv, vo2, workouts] =
    await Promise.all([
      db.dailyReadiness.toArray(),
      db.dailySleep.toArray(),
      db.sleep.toArray(),
      db.dailyActivity.toArray(),
      db.dailyStress.toArray(),
      db.dailyResilience.toArray(),
      db.dailySpo2.toArray(),
      db.cardiovascularAge.toArray(),
      db.vo2Max.toArray(),
      db.workout.toArray(),
    ])

  const byDay = new Map<string, DayBundle>()
  const bundle = (day: string) => {
    let b = byDay.get(day)
    if (!b) byDay.set(day, (b = { day, workouts: [] }))
    return b
  }
  for (const r of readiness) bundle(r.day).readiness = r
  for (const r of dailySleep) bundle(r.day).dailySleep = r
  for (const r of activity) bundle(r.day).activity = r
  for (const r of stress) bundle(r.day).stress = r
  for (const r of resilience) bundle(r.day).resilience = r
  for (const r of spo2) bundle(r.day).spo2 = r
  for (const r of cv) bundle(r.day).vascularAge = r
  for (const r of vo2) bundle(r.day).vo2 = r
  for (const r of workouts) bundle(r.day).workouts.push(r)

  const sessionsByDay = new Map<string, SleepSession[]>()
  for (const s of sleep) {
    const list = sessionsByDay.get(s.day) ?? []
    list.push(s)
    sessionsByDay.set(s.day, list)
  }
  for (const [day, list] of sessionsByDay) bundle(day).sleep = mainSleep(list)

  return { days: [...byDay.keys()].sort(), byDay }
}

/** Все дни из локальной базы, собранные в одну таблицу. */
export function useDailyData() {
  const { data, loading } = useLive(loadTable, EMPTY)
  return { table: data, loading }
}

export function metricValue(table: DailyTable, metricId: string, day: string): number | null {
  const b = table.byDay.get(day)
  return b ? (METRIC_BY_ID[metricId]?.get(b) ?? null) : null
}

/** Ряд значений метрики по списку дней. */
export function seriesFor(table: DailyTable, metricId: string, days: string[]) {
  return days.map((d) => metricValue(table, metricId, d))
}

/** Личная норма: медиана за 30 дней, предшествующих дню (сам день не входит). */
export function baselineFor(
  table: DailyTable,
  metricId: string,
  day: string,
  window = 30,
): number | null {
  const idx = table.days.findIndex((d) => d >= day)
  const end = idx === -1 ? table.days.length : idx
  const days = table.days.slice(Math.max(0, end - window), end)
  return median(nonNull(seriesFor(table, metricId, days)))
}

export function useDayBundle(
  table: Ref<DailyTable>,
  day: Ref<string>,
): ComputedRef<DayBundle | undefined> {
  return computed(() => table.value.byDay.get(day.value))
}

/** Дни выбранного периода (в днях от последнего дня данных; 0 — вся история). */
export function rangeDays(table: DailyTable, range: number): string[] {
  if (range <= 0) return table.days
  return table.days.slice(-range)
}

/** Последние `n` дней с данными, заканчивая указанным днём. */
export function lastNDays(table: DailyTable, day: string, n: number): string[] {
  const end = table.days.findIndex((d) => d > day)
  const upto = end === -1 ? table.days : table.days.slice(0, end)
  return upto.slice(-n)
}
