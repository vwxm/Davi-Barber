import { describe, it, expect } from 'vitest'
import { getBookingWeekDates, isDateInBookingWindow, getClientBookingWindow } from './booking-window'

// Wednesday 2026-06-03 in São Paulo (UTC-3). 06-06 is Sat, 06-07 is Sun.
const wed = '2026-06-03T12:00:00.000Z'
// Same SP day but the UTC instant is in the early hours of the next day —
// this is the case that used to leak Sundays / drop Saturdays on a UTC server.
const wedLateUTC = '2026-06-04T02:00:00.000Z' // = 2026-06-03 23:00 in SP
const sundayISO = '2026-06-07T15:00:00.000Z' // SP Sunday noon
const saturdayISO = '2026-06-06T12:00:00.000Z'

function isSunday(d: string) {
  return new Date(d + 'T12:00:00Z').getUTCDay() === 0
}

describe('getBookingWeekDates', () => {
  it('never includes a Sunday', () => {
    expect(getBookingWeekDates(wed).some(isSunday)).toBe(false)
  })

  it('includes Saturday and excludes the following Sunday', () => {
    const dates = getBookingWeekDates(wed)
    expect(dates).toContain('2026-06-06') // Saturday
    expect(dates).not.toContain('2026-06-07') // Sunday
  })

  it('is stable across the UTC day boundary (no off-by-one)', () => {
    expect(getBookingWeekDates(wedLateUTC)).toEqual(getBookingWeekDates(wed))
  })

  it('covers only the current week, starting today', () => {
    const dates = getBookingWeekDates(wed)
    expect(dates[0]).toBe('2026-06-03')
    expect(dates[dates.length - 1]).toBe('2026-06-06') // Saturday same week
  })

  it('is empty on Sundays', () => {
    expect(getBookingWeekDates(sundayISO)).toEqual([])
  })
})

describe('isDateInBookingWindow', () => {
  it('rejects Sundays', () => {
    expect(isDateInBookingWindow('2026-06-07', wed)).toBe(false)
  })
  it('accepts a Saturday in range', () => {
    expect(isDateInBookingWindow('2026-06-06', wed)).toBe(true)
  })
  it('rejects past dates', () => {
    expect(isDateInBookingWindow('2026-06-02', wed)).toBe(false)
  })
  it('rejects next-week dates', () => {
    expect(isDateInBookingWindow('2026-06-08', wed)).toBe(false)
    expect(isDateInBookingWindow('2026-06-13', wed)).toBe(false)
  })
  it('rejects everything on a Sunday', () => {
    expect(isDateInBookingWindow('2026-06-08', sundayISO)).toBe(false)
  })
})

describe('getClientBookingWindow', () => {
  it('covers today through Saturday mid-week', () => {
    const w = getClientBookingWindow(wed)!
    expect(w.start).toBe('2026-06-03')
    expect(w.end).toBe('2026-06-06')
  })

  it('is null on Sundays (next week opens Monday)', () => {
    expect(getClientBookingWindow(sundayISO)).toBeNull()
  })

  it('on Saturday the window is just Saturday', () => {
    const w = getClientBookingWindow(saturdayISO)!
    expect(w.start).toBe('2026-06-06')
    expect(w.end).toBe('2026-06-06')
  })
})
