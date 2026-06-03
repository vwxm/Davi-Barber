import { describe, it, expect } from 'vitest'
import { getAvailableSlots, timeToMinutes, minutesToTime } from './slots'
import type { Appointment, ScheduleBlock } from '@/types'

describe('timeToMinutes / minutesToTime', () => {
  it('converts 09:30 to 570', () => expect(timeToMinutes('09:30')).toBe(570))
  it('converts 570 to 09:30', () => expect(minutesToTime(570)).toBe('09:30'))
})

describe('getAvailableSlots', () => {
  // 2099-06-08 is a Monday in UTC (getUTCDay() === 1)
  const future = '2099-06-08'
  // 2099-06-07 is a Sunday in UTC (getUTCDay() === 0)
  const sunday = '2099-06-07'
  const nowISO = '2099-06-07T10:00:00.000Z'

  it('returns slots for a free Monday', () => {
    const slots = getAvailableSlots(future, 30, [], [], nowISO)
    expect(slots.length).toBeGreaterThan(0)
    expect(slots.every(s => s.available)).toBe(true)
  })

  it('returns empty for Sunday', () => {
    expect(getAvailableSlots(sunday, 30, [], [], nowISO)).toHaveLength(0)
  })

  it('marks slot unavailable when appointment conflicts', () => {
    const appt: Appointment = {
      id: '1', client_id: 'c1', service_id: 's1',
      date: future, start_time: '09:00', end_time: '09:30',
      status: 'scheduled', access_code: 'ABC123',
      monthly_client_id: null, week_start: null, google_event_id: null,
      sync_status: 'pending', sync_error: null,
      created_at: '', updated_at: '',
    }
    const slots = getAvailableSlots(future, 30, [appt], [], nowISO)
    const nineSlot = slots.find(s => s.start === '09:00')
    expect(nineSlot?.available).toBe(false)
  })

  it('excludes slots during break time', () => {
    const slots = getAvailableSlots(future, 30, [], [], nowISO)
    const breakSlot = slots.find(s => s.start === '12:00')
    expect(breakSlot).toBeUndefined()
  })

  it('returns empty for full_day block', () => {
    const block: ScheduleBlock = {
      id: 'b1', date: future, date_end: null, full_day: true,
      start_time: null, end_time: null,
      reason: 'Férias', active: true, created_at: '', updated_at: '',
    }
    expect(getAvailableSlots(future, 30, [], [block], nowISO)).toHaveLength(0)
  })

  it('returns empty when a full_day period block covers the date', () => {
    // future (2099-06-08) sits inside [2099-06-07, 2099-06-09]
    const block: ScheduleBlock = {
      id: 'b2', date: '2099-06-07', date_end: '2099-06-09', full_day: true,
      start_time: null, end_time: null,
      reason: 'Férias', active: true, created_at: '', updated_at: '',
    }
    expect(getAvailableSlots(future, 30, [], [block], nowISO)).toHaveLength(0)
  })

  it('ignores a period block that does not cover the date', () => {
    const block: ScheduleBlock = {
      id: 'b3', date: '2099-06-09', date_end: '2099-06-11', full_day: true,
      start_time: null, end_time: null,
      reason: 'Férias', active: true, created_at: '', updated_at: '',
    }
    const slots = getAvailableSlots(future, 30, [], [block], nowISO)
    expect(slots.length).toBeGreaterThan(0)
  })
})
