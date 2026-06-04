import { describe, it, expect } from 'vitest'
import { getBookingWeekDates, isDateInBookingWindow, getClientBookingWindow } from './booking-window'

// Wednesday 2026-06-03 in São Paulo (UTC-3). 06-06 is Sat, 06-07 is Sun.
const wed = '2026-06-03T12:00:00.000Z'
// Same SP day but the UTC instant is in the early hours of the next day —
// this is the case that used to leak Sundays / drop Saturdays on a UTC server.
const wedLateUTC = '2026-06-04T02:00:00.000Z' // = 2026-06-03 23:00 in SP

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

  it('spans two weeks, starting today', () => {
    const dates = getBookingWeekDates(wed)
    expect(dates[0]).toBe('2026-06-03')
    expect(dates[dates.length - 1]).toBe('2026-06-13') // Sat of next week
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
  it('rejects dates beyond the two-week window', () => {
    expect(isDateInBookingWindow('2026-06-15', wed)).toBe(false)
  })
})

describe('getClientBookingWindow on a Sunday', () => {
  it('starts the next Monday', () => {
    const { start } = getClientBookingWindow('2026-06-07T15:00:00.000Z') // SP Sunday noon
    expect(start).toBe('2026-06-08')
  })
})
