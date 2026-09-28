import { addDays, format, parseISO } from 'date-fns'
import { metricValue, type DailyTable } from '@/composables/useDailyData'
import { formatClock, METRICS, METRIC_BY_ID, type MetricDef } from '@/metrics/registry'
import { mean, median, nonNull, pearson } from './stats'

export interface AiExportOptions {
  /** Сколько последних дней с данными включить. */
  days: number
  includeDaily: boolean
  includeCorrelations: boolean
  /** Цель или контекст пользователя (свободный текст). */
  context: string
}

/** Колонки дневной таблицы — компромисс между полнотой и размером текста. */
const DAILY_COLUMNS = [
  'readiness_score',
  'sleep_score',
  'activity_score',
  'sleep_hours',
  'deep_min',
  'rem_min',
  'efficiency',
  'bedtime',
  'hrv',
  'rhr',
  'temp_dev',
  'steps',
  'active_cal',
  'stress_min',
  'workouts',
]

/** Пары для раздела корреляций: X в день d, Y в день d + shift. */
const CORRELATION_PAIRS: { x: string; y: string; shift: number }[] = [
  { x: 'bedtime', y: 'hrv', shift: 1 },
  { x: 'bedtime', y: 'sleep_score', shift: 1 },
  { x: 'steps', y: 'sleep_score', shift: 1 },
  { x: 'active_cal', y: 'readiness_score', shift: 1 },
  { x: 'sleep_hours', y: 'readiness_score', shift: 1 },
  { x: 'stress_min', y: 'hrv', shift: 1 },
  { x: 'stress_min', y: 'sleep_score', shift: 1 },
  { x: 'workouts', y: 'hrv', shift: 1 },
]

/** Число без разделителей тысяч и лишних нулей; время отбоя — как ЧЧ:ММ. */
function num(def: MetricDef, v: number | null | undefined, extraDigits = 0): string {
  if (v == null || Number.isNaN(v)) return '—'
  if (def.asClock) return formatClock(v)
  return String(Number(v.toFixed(def.digits + extraDigits)))
}

/** Средние округляем на знак точнее, чтобы «0,2 тренировки» не превращались в 0. */
const avgNum = (def: MetricDef, v: number | null | undefined) =>
  num(def, v, def.digits === 0 && v != null && Math.abs(v) < 10 ? 1 : 0)

function signed(def: MetricDef, v: number): string {
  if (def.asClock) {
    const minutes = Math.round(v * 60)
    return `${minutes > 0 ? '+' : ''}${minutes} мин`
  }
  const digits = Math.max(def.digits, 1)
  const rounded = Number(v.toFixed(digits))
  if (rounded === 0) return '0'
  return rounded > 0 ? `+${rounded}` : String(rounded)
}

const label = (def: MetricDef) => (def.unit ? `${def.label}, ${def.unit}` : def.label)

function periodDays(table: DailyTable, n: number): { current: string[]; previous: string[] } {
  const all = table.days
  return {
    current: all.slice(-n),
    previous: all.slice(Math.max(0, all.length - 2 * n), Math.max(0, all.length - n)),
  }
}

function summaryTable(table: DailyTable, current: string[], previous: string[]): string {
  const rows = [
    '| Метрика | Среднее | Медиана | Мин | Макс | Пред. период | Изменение |',
    '|---|---|---|---|---|---|---|',
  ]
  for (const def of METRICS) {
    const cur = nonNull(current.map((d) => metricValue(table, def.id, d)))
    if (!cur.length) continue
    const prev = nonNull(previous.map((d) => metricValue(table, def.id, d)))
    const avg = mean(cur)!
    const prevAvg = mean(prev)
    const change = prevAvg != null ? signed(def, avg - prevAvg) : '—'
    rows.push(
      `| ${label(def)} | ${avgNum(def, avg)} | ${num(def, median(cur))} | ${num(def, Math.min(...cur))} | ${num(def, Math.max(...cur))} | ${avgNum(def, prevAvg)} | ${change} |`,
    )
  }
  return rows.join('\n')
}

function dailyTable(table: DailyTable, days: string[]): string {
  const defs = DAILY_COLUMNS.map((id) => METRIC_BY_ID[id]!)
  const header = `| Дата | ${defs.map(label).join(' | ')} |`
  const sep = `|---|${defs.map(() => '---').join('|')}|`
  const rows = days.map(
    (day) =>
      `| ${day} | ${defs.map((def) => num(def, metricValue(table, def.id, day))).join(' | ')} |`,
  )
  return [header, sep, ...rows].join('\n')
}

function correlations(table: DailyTable): string {
  const lines: string[] = []
  for (const pair of CORRELATION_PAIRS) {
    const xs: number[] = []
    const ys: number[] = []
    for (const day of table.days) {
      const x = metricValue(table, pair.x, day)
      const nextDay = format(addDays(parseISO(day), pair.shift), 'yyyy-MM-dd')
      const y = metricValue(table, pair.y, nextDay)
      if (x != null && y != null) {
        xs.push(x)
        ys.push(y)
      }
    }
    const r = pearson(xs, ys)
    if (!r) continue
    const p = r.p < 0.001 ? '< 0.001' : r.p.toFixed(3)
    const note = r.n < 30 || r.p >= 0.05 || Math.abs(r.r) < 0.2 ? ' (слабая/незначимая)' : ''
    lines.push(
      `- ${METRIC_BY_ID[pair.x]!.label} → ${METRIC_BY_ID[pair.y]!.label} (${pair.shift ? 'на следующий день' : 'в тот же день'}): r = ${r.r.toFixed(2)}, n = ${r.n}, p ${p.startsWith('<') ? p : `= ${p}`}${note}`,
    )
  }
  return lines.join('\n')
}

/** Markdown-отчёт с инструкцией для AI-ассистента и данными за выбранный период. */
export function buildAiReport(table: DailyTable, options: AiExportOptions): string {
  const { current, previous } = periodDays(table, options.days)
  if (!current.length) return ''
  const from = current[0]!
  const to = current[current.length - 1]!

  const parts: string[] = []
  parts.push(`# Данные Oura Ring за ${from} — ${to} (${current.length} дн.)`)
  parts.push(
    [
      'Ты — внимательный консультант по сну, восстановлению и активности. Ниже мои данные с кольца Oura.',
      'Проанализируй их и ответь по-русски:',
      '1. Что у меня в хорошем состоянии, а что ухудшилось по сравнению с предыдущим периодом.',
      '2. Какие закономерности видны в данных (режим сна, нагрузка, стресс, HRV, пульс в покое).',
      '3. 3–5 конкретных и выполнимых рекомендаций, отсортированных по ожидаемому эффекту, — с объяснением, на какие цифры каждая опирается.',
      '4. Какие метрики отслеживать, чтобы понять, что рекомендации работают.',
      'Опирайся только на приведённые данные, отмечай, где выводы ненадёжны из-за малого числа дней. Это не медицинская консультация: если что-то выглядит тревожно, так и скажи и посоветуй обратиться к врачу.',
    ].join('\n'),
  )

  if (options.context.trim()) parts.push(`## Обо мне и моя цель\n\n${options.context.trim()}`)

  parts.push(
    [
      '## Как читать данные',
      '',
      '- Оценки (готовность, сон, активность) — шкала Oura 0–100: 85+ отлично, 70–84 хорошо, ниже 70 — обратить внимание.',
      '- HRV — среднее за ночь; пульс в покое — минимальный за ночь.',
      '- Отклонение температуры — относительно личной нормы, °C.',
      '- Время отбоя — локальное время начала основного сна.',
      `- «Пред. период» — те же метрики за предыдущие ${previous.length} дн. с данными.`,
    ].join('\n'),
  )

  parts.push(`## Сводка за период\n\n${summaryTable(table, current, previous)}`)

  if (options.includeCorrelations) {
    const corr = correlations(table)
    if (corr)
      parts.push(
        `## Корреляции по всей истории (${table.days.length} дн.)\n\nКоэффициент Пирсона r; корреляция не означает причинность.\n\n${corr}`,
      )
  }

  if (options.includeDaily) parts.push(`## По дням\n\n${dailyTable(table, current)}`)

  return parts.join('\n\n') + '\n'
}
