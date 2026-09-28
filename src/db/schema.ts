import Dexie, { type EntityTable } from 'dexie'
import type {
  CardiovascularAge,
  DailyActivity,
  DailyReadiness,
  DailyResilience,
  DailySleep,
  DailySpo2,
  DailyStress,
  HeartRatePoint,
  SleepSession,
  Vo2Max,
  Workout,
} from '@/api/types'

export interface HeartDay {
  day: string
  points: HeartRatePoint[]
  fetchedAt: number
}

export interface MetaRow {
  key: string
  value: string
}

export class OuraDb extends Dexie {
  dailyReadiness!: EntityTable<DailyReadiness, 'id'>
  dailySleep!: EntityTable<DailySleep, 'id'>
  sleep!: EntityTable<SleepSession, 'id'>
  dailyActivity!: EntityTable<DailyActivity, 'id'>
  dailyStress!: EntityTable<DailyStress, 'id'>
  dailyResilience!: EntityTable<DailyResilience, 'id'>
  dailySpo2!: EntityTable<DailySpo2, 'id'>
  cardiovascularAge!: EntityTable<CardiovascularAge, 'id'>
  vo2Max!: EntityTable<Vo2Max, 'id'>
  workout!: EntityTable<Workout, 'id'>
  heartDays!: EntityTable<HeartDay, 'day'>
  meta!: EntityTable<MetaRow, 'key'>

  constructor() {
    super('oura-ring')
    this.version(1).stores({
      dailyReadiness: '&id, day',
      dailySleep: '&id, day',
      sleep: '&id, day',
      dailyActivity: '&id, day',
      dailyStress: '&id, day',
      dailyResilience: '&id, day',
      dailySpo2: '&id, day',
      cardiovascularAge: '&id, day',
      vo2Max: '&id, day',
      workout: '&id, day',
      heartDays: '&day',
      meta: '&key',
    })
  }
}

export const db = new OuraDb()
