import { parseISO } from 'date-fns'
import type {
  CardiovascularAge,
  DailyActivity,
  DailyReadiness,
  DailyResilience,
  DailySleep,
  DailySpo2,
  DailyStress,
  SleepSession,
  Vo2Max,
  Workout,
} from '@/api/types'

/** Всё, что известно об одном дне. */
export interface DayBundle {
  day: string
  readiness?: DailyReadiness
  dailySleep?: DailySleep
  /** Основная ночь (самая длинная сессия сна дня). */
  sleep?: SleepSession
  activity?: DailyActivity
  stress?: DailyStress
  resilience?: DailyResilience
  spo2?: DailySpo2
  vascularAge?: CardiovascularAge
  vo2?: Vo2Max
  workouts: Workout[]
}

export type Section = 'sleep' | 'readiness' | 'activity' | 'heart'

export interface MetricDef {
  id: string
  label: string
  unit: string
  section: Section
  digits: number
  /** Чем больше, тем лучше; null — однозначной оценки нет. Нужно для цвета отклонений. */
  better: 'up' | 'down' | null
  get: (d: DayBundle) => number | null | undefined
  /** Если задан, значение показывается как время суток (значение — часы от полуночи). */
  asClock?: boolean
  /** Значение может быть отрицательным или около нуля — проценты изменения не имеют смысла. */
  signed?: boolean
}

const min = (sec: number | null | undefined) => (sec == null ? null : sec / 60)
const hours = (sec: number | null | undefined) => (sec == null ? null : sec / 3600)

/** Время отбоя в часах относительно полуночи: 23:30 → -0.5, 01:00 → 1. */
function bedtimeHours(iso: string | undefined): number | null {
  if (!iso) return null
  const m = /T(\d{2}):(\d{2})/.exec(iso)
  if (!m) return null
  const h = Number(m[1]) + Number(m[2]) / 60
  return h >= 12 ? h - 24 : h
}

export const METRICS: MetricDef[] = [
  {
    id: 'readiness_score',
    label: 'Готовность',
    unit: '',
    section: 'readiness',
    digits: 0,
    better: 'up',
    get: (d) => d.readiness?.score,
  },
  {
    id: 'sleep_score',
    label: 'Оценка сна',
    unit: '',
    section: 'sleep',
    digits: 0,
    better: 'up',
    get: (d) => d.dailySleep?.score,
  },
  {
    id: 'activity_score',
    label: 'Оценка активности',
    unit: '',
    section: 'activity',
    digits: 0,
    better: 'up',
    get: (d) => d.activity?.score,
  },

  {
    id: 'sleep_hours',
    label: 'Длительность сна',
    unit: 'ч',
    section: 'sleep',
    digits: 1,
    better: 'up',
    get: (d) => hours(d.sleep?.total_sleep_duration),
  },
  {
    id: 'deep_min',
    label: 'Глубокий сон',
    unit: 'мин',
    section: 'sleep',
    digits: 0,
    better: 'up',
    get: (d) => min(d.sleep?.deep_sleep_duration),
  },
  {
    id: 'rem_min',
    label: 'REM-сон',
    unit: 'мин',
    section: 'sleep',
    digits: 0,
    better: 'up',
    get: (d) => min(d.sleep?.rem_sleep_duration),
  },
  {
    id: 'light_min',
    label: 'Лёгкий сон',
    unit: 'мин',
    section: 'sleep',
    digits: 0,
    better: null,
    get: (d) => min(d.sleep?.light_sleep_duration),
  },
  {
    id: 'awake_min',
    label: 'Бодрствование ночью',
    unit: 'мин',
    section: 'sleep',
    digits: 0,
    better: 'down',
    get: (d) => min(d.sleep?.awake_time),
  },
  {
    id: 'efficiency',
    label: 'Эффективность сна',
    unit: '%',
    section: 'sleep',
    digits: 0,
    better: 'up',
    get: (d) => d.sleep?.efficiency,
  },
  {
    id: 'latency_min',
    label: 'Засыпание',
    unit: 'мин',
    section: 'sleep',
    digits: 0,
    better: 'down',
    get: (d) => min(d.sleep?.latency),
  },
  {
    id: 'bedtime',
    label: 'Время отбоя',
    unit: '',
    section: 'sleep',
    digits: 2,
    better: null,
    asClock: true,
    get: (d) => bedtimeHours(d.sleep?.bedtime_start),
  },
  {
    id: 'breathing',
    label: 'Дыхание во сне',
    unit: 'дых/мин',
    section: 'sleep',
    digits: 1,
    better: null,
    get: (d) => d.sleep?.average_breath,
  },

  {
    id: 'hrv',
    label: 'HRV',
    unit: 'мс',
    section: 'readiness',
    digits: 0,
    better: 'up',
    get: (d) => d.sleep?.average_hrv,
  },
  {
    id: 'rhr',
    label: 'Пульс в покое',
    unit: 'уд/мин',
    section: 'heart',
    digits: 0,
    better: 'down',
    get: (d) => d.sleep?.lowest_heart_rate,
  },
  {
    id: 'sleep_hr',
    label: 'Средний пульс во сне',
    unit: 'уд/мин',
    section: 'heart',
    digits: 0,
    better: 'down',
    get: (d) => d.sleep?.average_heart_rate,
  },
  {
    id: 'temp_dev',
    label: 'Отклонение температуры',
    unit: '°C',
    section: 'readiness',
    digits: 2,
    better: null,
    get: (d) => d.readiness?.temperature_deviation,
  },
  {
    id: 'spo2',
    label: 'SpO2',
    unit: '%',
    section: 'readiness',
    digits: 1,
    better: 'up',
    get: (d) => d.spo2?.spo2_percentage?.average,
  },
  {
    id: 'stress_min',
    label: 'Высокий стресс',
    unit: 'мин',
    section: 'readiness',
    digits: 0,
    better: 'down',
    get: (d) => min(d.stress?.stress_high),
  },
  {
    id: 'recovery_min',
    label: 'Восстановление днём',
    unit: 'мин',
    section: 'readiness',
    digits: 0,
    better: 'up',
    get: (d) => min(d.stress?.recovery_high),
  },
  {
    id: 'vo2',
    label: 'VO2 max',
    unit: 'мл/кг/мин',
    section: 'readiness',
    digits: 1,
    better: 'up',
    get: (d) => d.vo2?.vo2_max,
  },
  {
    id: 'vascular_age',
    label: 'Сосудистый возраст',
    unit: 'лет',
    section: 'readiness',
    digits: 0,
    better: 'down',
    get: (d) => d.vascularAge?.vascular_age,
  },

  {
    id: 'steps',
    label: 'Шаги',
    unit: '',
    section: 'activity',
    digits: 0,
    better: 'up',
    get: (d) => d.activity?.steps,
  },
  {
    id: 'active_cal',
    label: 'Активные калории',
    unit: 'ккал',
    section: 'activity',
    digits: 0,
    better: 'up',
    get: (d) => d.activity?.active_calories,
  },
  {
    id: 'total_cal',
    label: 'Всего калорий',
    unit: 'ккал',
    section: 'activity',
    digits: 0,
    better: null,
    get: (d) => d.activity?.total_calories,
  },
  {
    id: 'high_min',
    label: 'Высокая активность',
    unit: 'мин',
    section: 'activity',
    digits: 0,
    better: 'up',
    get: (d) => min(d.activity?.high_activity_time),
  },
  {
    id: 'medium_min',
    label: 'Средняя активность',
    unit: 'мин',
    section: 'activity',
    digits: 0,
    better: 'up',
    get: (d) => min(d.activity?.medium_activity_time),
  },
  {
    id: 'sedentary_h',
    label: 'Сидячее время',
    unit: 'ч',
    section: 'activity',
    digits: 1,
    better: 'down',
    get: (d) => hours(d.activity?.sedentary_time),
  },
  {
    id: 'workouts',
    label: 'Тренировок',
    unit: '',
    section: 'activity',
    digits: 0,
    better: 'up',
    get: (d) => d.workouts.length,
  },
]

export const METRIC_BY_ID: Record<string, MetricDef> = Object.fromEntries(
  METRICS.map((m) => [m.id, m]),
)

export const SECTION_COLOR: Record<Section, string> = {
  sleep: '#7c83fd',
  readiness: '#3dd6c6',
  activity: '#ff9f5a',
  heart: '#ff6b81',
}

export function formatClock(hoursFromMidnight: number): string {
  let h = hoursFromMidnight
  if (h < 0) h += 24
  const total = Math.round(h * 60) % (24 * 60)
  const hh = String(Math.floor(total / 60)).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

export function formatMetric(def: MetricDef, value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  if (def.asClock) return formatClock(value)
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: def.digits,
  })
}

/** Длительность в секундах → «7 ч 32 мин». */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—'
  const total = Math.round(seconds / 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`
}

export const dayToDate = (day: string) => parseISO(day)

/** Часы:минуты из ISO-строки Oura как есть (в часовом поясе кольца, без пересчёта в локальный). */
export function clockOf(iso: string | undefined | null): string {
  const m = iso ? /T(\d{2}:\d{2})/.exec(iso) : null
  return m ? m[1]! : '—'
}

export const READINESS_CONTRIBUTORS: [string, string][] = [
  ['hrv_balance', 'Баланс HRV'],
  ['resting_heart_rate', 'Пульс в покое'],
  ['recovery_index', 'Индекс восстановления'],
  ['previous_night', 'Прошлая ночь'],
  ['sleep_balance', 'Баланс сна'],
  ['sleep_regularity', 'Регулярность сна'],
  ['previous_day_activity', 'Активность вчера'],
  ['activity_balance', 'Баланс активности'],
  ['body_temperature', 'Температура тела'],
]
