import { describe, it, expect } from 'vitest'
import { getAvailableSlots, timeToMinutes, minutesToTime, type EffectiveHours } from './slots'
import type { Appointment, ScheduleBlock } from '@/types'

const HOURS: EffectiveHours = { start: '10:00', end: '20:00' }

// 2027-01-15 is a Friday; 2027-01-17 is a Sunday. "now" is long before both.
const future = '2027-01-15'
const sunday = '2027-01-17'
const nowISO = '2026-12-01T12:00:00-03:00'

function appt(partial: Partial<Appointment>): Appointment {
  return {
    id: 'a', client_id: 'c', service_id: 's', date: future,
    start_time: '10:00', end_time: '10:30', status: 'scheduled',
    access_code: 'X', monthly_client_id: null, week_start: null,
    google_event_id: null, sync_status: 'pending', sync_error: null,
    created_at: '', updated_at: '', ...partial,
  } as Appointment
}

function block(partial: Partial<ScheduleBlock>): ScheduleBlock {
  return {
    id: 'b', date: future, date_end: null, full_day: true,
    start_time: null, end_time: null, reason: null, active: true,
    created_at: '', updated_at: '', ...partial,
  }
}

describe('timeToMinutes / minutesToTime', () => {
  it('converts 09:30 to 570', () => expect(timeToMinutes('09:30')).toBe(570))
  it('converts 570 to 09:30', () => expect(minutesToTime(570)).toBe('09:30'))
})

describe('getAvailableSlots', () => {
  it('generates 30-min slots across the effective hours with no lunch break', () => {
    const slots = getAvailableSlots(future, 30, [], [], nowISO, HOURS)
    expect(slots[0].start).toBe('10:00')
    expect(slots[slots.length - 1].start).toBe('19:30')
    expect(slots).toHaveLength(20) // 10h..20h = 10h * 2
    expect(slots.some(s => s.start === '12:00')).toBe(true)
  })

  it('respects per-day hours (override shape)', () => {
    const slots = getAvailableSlots(future, 30, [], [], nowISO, { start: '09:00', end: '21:00' })
    expect(slots[0].start).toBe('09:00')
    expect(slots[slots.length - 1].start).toBe('20:30')
  })

  it('returns [] on Sundays', () => {
    expect(getAvailableSlots(sunday, 30, [], [], nowISO, HOURS)).toHaveLength(0)
  })

  it('marks conflicting slots unavailable', () => {
    const slots = getAvailableSlots(future, 30, [appt({ start_time: '10:00', end_time: '10:30' })], [], nowISO, HOURS)
    expect(slots.find(s => s.start === '10:00')!.available).toBe(false)
    expect(slots.find(s => s.start === '10:30')!.available).toBe(true)
  })

  it('long services need room before close', () => {
    const slots = getAvailableSlots(future, 60, [], [], nowISO, HOURS)
    expect(slots[slots.length - 1].start).toBe('19:00')
  })

  it('full-day block removes all slots', () => {
    expect(getAvailableSlots(future, 30, [], [block({})], nowISO, HOURS)).toHaveLength(0)
  })

  it('full-day period block covering the date removes all slots', () => {
    const b = block({ date: '2027-01-14', date_end: '2027-01-16' })
    expect(getAvailableSlots(future, 30, [], [b], nowISO, HOURS)).toHaveLength(0)
  })

  it('ignores a period block that does not cover the date', () => {
    const b = block({ date: '2027-01-18', date_end: '2027-01-20' })
    expect(getAvailableSlots(future, 30, [], [b], nowISO, HOURS).length).toBeGreaterThan(0)
  })

  it('time-range block removes overlapping slots only', () => {
    const b = block({ full_day: false, start_time: '10:00', end_time: '11:00' })
    const slots = getAvailableSlots(future, 30, [], [b], nowISO, HOURS)
    expect(slots.some(s => s.start === '10:00')).toBe(false)
    expect(slots.some(s => s.start === '10:30')).toBe(false)
    expect(slots.some(s => s.start === '11:00')).toBe(true)
  })

  describe('lead time (same-day)', () => {
    // "now" = 19:01 São Paulo on the slot date
    const todayISO = '2027-01-15T19:01:00-03:00'

    it('lead 60: the 20:00 slot disappears at 19:01', () => {
      const slots = getAvailableSlots(future, 30, [], [], todayISO, { start: '10:00', end: '20:30' }, 60)
      expect(slots.some(s => s.start === '20:00')).toBe(false)
    })

    it('lead 60: a slot at least 60 min away stays', () => {
      const slots = getAvailableSlots(future, 30, [], [], todayISO, { start: '10:00', end: '21:00' }, 60)
      expect(slots.some(s => s.start === '20:30')).toBe(true)
    })

    it('lead 0 keeps the old behavior (only past slots cut)', () => {
      const slots = getAvailableSlots(future, 30, [], [], todayISO, { start: '10:00', end: '20:30' }, 0)
      expect(slots.some(s => s.start === '20:00')).toBe(true)
      expect(slots.some(s => s.start === '19:00')).toBe(false)
    })

    it('lead does not affect future dates', () => {
      const slots = getAvailableSlots(future, 30, [], [], nowISO, HOURS, 60)
      expect(slots[0].start).toBe('10:00')
    })
  })
})
