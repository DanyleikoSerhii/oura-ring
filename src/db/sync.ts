import { addDays, format, formatISO, parseISO, startOfDay } from 'date-fns'
import { ApiError, fetchAll } from '@/api/client'
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
      end_date: `${year + 1}-01-01`,
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

export interface EndpointFailure {
  label: string
  status: number | null
  message: string
}

/**
 * Полная или инкрементальная синхронизация всех эндпоинтов в IndexedDB.
 * Ошибка одного эндпоинта (например, нет нужного скоупа) не останавливает остальные —
 * она возвращается в списке. `full: true` игнорирует накопленное состояние.
 */
export async function syncAll(
  onProgress: (p: SyncProgress) => void,
  options: { full?: boolean } = {},
): Promise<EndpointFailure[]> {
  if (options.full) await resetDb()
  const historyStart = await findHistoryStart()
  const end = today()
  const failures: EndpointFailure[] = []

  for (const ep of ENDPOINTS) {
    try {
      await syncEndpoint(ep, historyStart, end, onProgress)
    } catch (e) {
      // Сетевые сбои и 429 после всех повторов прерывают синхронизацию целиком.
      if (!(e instanceof ApiError) || e.status === 429 || e.status >= 500) throw e
      failures.push({ label: ep.label, status: e.status, message: e.message })
    }
  }

  await setMeta('lastSyncAt', new Date().toISOString())
  return failures
}

async function syncEndpoint(
  ep: EndpointConfig,
  historyStart: string,
  end: string,
  onProgress: (p: SyncProgress) => void,
) {
  const lastKey = `synced:${ep.path}`
  const last = await getMeta(lastKey)
  const from = last ? format(addDays(parseISO(last), -RESYNC_TAIL_DAYS), DAY_FORMAT) : historyStart
  const windows = chunks(from < historyStart ? historyStart : from, end)
  for (const [i, [start, stop]] of windows.entries()) {
    onProgress({ label: ep.label, done: i, total: windows.length })
    // Oura трактует end_date как исключительную границу, а /sleep фильтрует по UTC-времени
    // начала сна, а не по `day` (ночь дня D начинается вечером D-1). Поэтому окно расширяем
    // с обеих сторон; дубли безопасны — записи upsert-ятся по id.
    const rows = await fetchAll<Row>(ep.path, {
      start_date: format(addDays(parseISO(start), -1), DAY_FORMAT),
      end_date: format(addDays(parseISO(stop), 2), DAY_FORMAT),
    })
    await saveRows(ep.table, rows)
  }
  await setMeta(lastKey, end)
  onProgress({ label: ep.label, done: windows.length, total: windows.length })
}

export async function resetDb() {
  await Promise.all(db.tables.map((t) => t.clear()))
}

/** Пульс за сутки грузится по запросу и кэшируется (текущие сутки перекачиваются всегда). */
export async function loadHeartDay(day: string, force = false): Promise<HeartRatePoint[]> {
  const cached = await db.heartDays.get(day)
  if (cached && !force && day !== today()) return cached.points
  // Границы суток передаём с локальным смещением часового пояса (2021-11-01T00:00:00+03:00).
  const start = startOfDay(parseISO(day))
  const points = await fetchAll<HeartRatePoint>('heartrate', {
    start_datetime: formatISO(start),
    end_datetime: formatISO(addDays(start, 1)),
  })
  await db.heartDays.put({ day, points, fetchedAt: Date.now() })
  return points
}
