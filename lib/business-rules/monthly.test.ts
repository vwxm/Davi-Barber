import { describe, it, expect } from 'vitest'
import { currentWeekMonday, weekdayDateInCurrentWeek } from './monthly'

// 2026-06-01 Mon, 06-03 Wed, 06-05 Fri, 06-06 Sat, 06-07 Sun
const wedNoonUTC = '2026-06-03T12:00:00.000Z'

describe('currentWeekMonday', () => {
  it('returns Monday of the current week from a Wednesday', () => {
    expect(currentWeekMonday(wedNoonUTC)).toBe('2026-06-01')
  })

  it('treats Sunday as belonging to the week that just ended', () => {
    expect(currentWeekMonday('2026-06-07T12:00:00.000Z')).toBe('2026-06-01')
  })

  it('handles month rollover', () => {
    // 2026-07-01 is a Wednesday; its Monday is 2026-06-29
    expect(currentWeekMonday('2026-07-01T12:00:00.000Z')).toBe('2026-06-29')
  })

  it('uses São Paulo date when UTC instant is previous-day-late', () => {
    // 2026-06-08T02:00Z = 2026-06-07 23:00 in SP (Sunday) -> Monday 2026-06-01
    expect(currentWeekMonday('2026-06-08T02:00:00.000Z')).toBe('2026-06-01')
  })
})

describe('weekdayDateInCurrentWeek', () => {
  it('maps weekdays Mon..Sat to dates in the current week', () => {
    expect(weekdayDateInCurrentWeek(1, wedNoonUTC)).toBe('2026-06-01') // Mon
    expect(weekdayDateInCurrentWeek(3, wedNoonUTC)).toBe('2026-06-03') // Wed
    expect(weekdayDateInCurrentWeek(5, wedNoonUTC)).toBe('2026-06-05') // Fri
    expect(weekdayDateInCurrentWeek(6, wedNoonUTC)).toBe('2026-06-06') // Sat
  })

  it('maps Sunday (0) to the end of the Mon-anchored week', () => {
    expect(weekdayDateInCurrentWeek(0, wedNoonUTC)).toBe('2026-06-07')
  })
})
