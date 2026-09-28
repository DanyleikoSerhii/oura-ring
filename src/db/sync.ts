import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { fetchAll } from '@/api/client'
import type { HeartRatePoint } from '@/api/types'
import { db } from './schema'

const DAY_FORMAT = 'yyyy-MM-dd'
const CHUNK_DAYS = 180
/** Oura пересчитывает последние дни задним числом, поэтому перекачиваем небольшой хвост. */
const RESYNC_TAIL_DAYS = 3
const FIRST_POSSIBLE_YEAR = 2015

type SyncTable =
  | 'dailyReadiness'
  | 'dailySleep'
  | 'sleep'
  | 'dailyActivity'
  | 'dailyStress'
  | 'dailyResilience'
  | 'dailySpo2'
  | 'cardiovascularAge'
  | 'vo2Max'
  | 'workout'

interface EndpointConfig {
  path: string
  table: SyncTable
  label: string
}

export const ENDPOINTS: EndpointConfig[] = [
  { path: 'daily_sleep', table: 'dailySleep', label: 'Сон: сводка' },
  { path: 'sleep', table: 'sleep', label: 'Сон: детали' },
  { path: 'daily_readiness', table: 'dailyReadiness', label: 'Готовность' },
  { path: 'daily_activity', table: 'dailyActivity', label: 'Активность' },
  { path: 'daily_stress', table: 'dailyStress', label: 'Стресс' },
  { path: 'daily_resilience', table: 'dailyResilience', label: 'Устойчивость' },
  { path: 'daily_spo2', table: 'dailySpo2', label: 'SpO2' },
  { path: 'daily_cardiovascular_age', table: 'cardiovascularAge', label: 'Сосудистый возраст' },
  { path: 'vO2_max', table: 'vo2Max', label: 'VO2 max' },
  { path: 'workout', table: 'workout', label: 'Тренировки' },
]

export interface SyncProgress {
  label: string
  done: number
  total: number
}

export const today = () => format(new Date(), DAY_FORMAT)

async function getMeta(key: string): Promise<string | undefined> {
  return (await db.meta.get(key))?.value
}

const setMeta = (key: string, value: string) => db.meta.put({ key, value })

export const getLastSync = async (): Promise<string | undefined> => getMeta('lastSyncAt')

type Row = { id?: string; day: string }

async function saveRows(table: SyncTable, rows: Row[]) {
  // У части эндпоинтов нет собственного id — используем день.
  const normalized = rows.map((row) => ({ ...row, id: row.id ?? row.day }))
  await (db[table] as unknown as { bulkPut: (r: unknown[]) => Promise<unknown> }).bulkPut(
    normalized,
  )
}

/** Первый день, за который у аккаунта есть данные (перебор по годам по сводке сна). */
async function findHistoryStart(): Promise<string> {
  const known = await getMeta('historyStart')
  if (known) return known
  const currentYear = new Date().getFullYear()
  for (let year = FIRST_POSSIBLE_YEAR; year <= currentYear; year++) {
    const rows = await fetchAll<Row>('daily_sleep', {
      start_date: `${year}-01-01`,
      end_date: `${year}-12-31`,
    })
    if (rows.length > 0) {
      const first = rows.map((r) => r.day).sort()[0]!
      await setMeta('historyStart', first)
      return first
    }
  }
  throw new Error('В аккаунте Oura не найдено данных о сне.')
}

/** Диапазон дат, разбитый на окна, чтобы запросы не были слишком тяжёлыми. */
function chunks(from: string, to: string): [string, string][] {
  const result: [string, string][] = []
  let start = parseISO(from)
  const end = parseISO(to)
  while (start <= end) {
    const chunkEnd = addDays(start, CHUNK_DAYS - 1)
    const last = chunkEnd < end ? chunkEnd : end
    result.push([format(start, DAY_FORMAT), format(last, DAY_FORMAT)])
    start = addDays(last, 1)
  }
  return result
}

/**
 * Полная или инкрементальная синхронизация всех эндпоинтов в IndexedDB.
 * `full: true` игнорирует накопленное состояние и качает историю заново.
 */
export async function syncAll(
  onProgress: (p: SyncProgress) => void,
  options: { full?: boolean } = {},
): Promise<void> {
  if (options.full) await resetDb()
  const historyStart = await findHistoryStart()
  const end = today()

  for (const ep of ENDPOINTS) {
    const lastKey = `synced:${ep.path}`
    const last = await getMeta(lastKey)
    const from = last
      ? format(addDays(parseISO(last), -RESYNC_TAIL_DAYS), DAY_FORMAT)
      : historyStart
    const windows = chunks(from < historyStart ? historyStart : from, end)
    for (const [i, [start, stop]] of windows.entries()) {
      onProgress({ label: ep.label, done: i, total: windows.length })
      // Для end_date Oura считает границу исключительной у части эндпоинтов — берём +1 день.
      const rows = await fetchAll<Row>(ep.path, {
        start_date: start,
        end_date: format(addDays(parseISO(stop), 1), DAY_FORMAT),
      })
      await saveRows(ep.table, rows)
    }
    await setMeta(lastKey, end)
    onProgress({ label: ep.label, done: windows.length, total: windows.length })
  }

  await setMeta('lastSyncAt', new Date().toISOString())
}

export async function resetDb() {
  await Promise.all(db.tables.map((t) => t.clear()))
}

/** Пульс за сутки грузится по запросу и кэшируется (текущие сутки перекачиваются всегда). */
export async function loadHeartDay(day: string, force = false): Promise<HeartRatePoint[]> {
  const cached = await db.heartDays.get(day)
  if (cached && !force && day !== today()) return cached.points
  const start = parseISO(day)
  const points = await fetchAll<HeartRatePoint>('heartrate', {
    start_datetime: `${format(start, DAY_FORMAT)}T00:00:00`,
    end_datetime: `${format(addDays(start, 1), DAY_FORMAT)}T00:00:00`,
  })
  await db.heartDays.put({ day, points, fetchedAt: Date.now() })
  return points
}

export const daysBetween = (a: string, b: string) =>
  differenceInCalendarDays(parseISO(b), parseISO(a))
