import { TIMEZONE } from './slots'

// How many weeks ahead clients may book (1 = current week only, 2 = current + next).
export const BOOKING_WEEKS = 2

// All date math is string-based on 'YYYY-MM-DD' in the business timezone, with
// weekday derived via UTC-noon. This avoids the UTC/local mismatch that made
// Sundays leak in (and Saturdays drop out) when the server runs in UTC.

function todayStr(nowISO?: string): string {
  const now = nowISO ? new Date(nowISO) : new Date()
  return now.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function weekdayOf(dateStr: string): number {
  return new Date(dateStr + 'T12:00:00Z').getUTCDay() // 0=Sun..6=Sat
}

export interface BookingWindow {
  start: string // 'YYYY-MM-DD'
  end: string   // 'YYYY-MM-DD'
}

export function getClientBookingWindow(nowISO?: string): BookingWindow {
  const today = todayStr(nowISO)
  const dow = weekdayOf(today) // 0=Sun
  // Sunday -> start next Monday; otherwise -> Monday of this week.
  const daysToMonday = dow === 0 ? 1 : 1 - dow
  const monday = addDays(today, daysToMonday)

  // Saturday of the last bookable week.
  const end = addDays(monday, 5 + (BOOKING_WEEKS - 1) * 7)

  // Never offer past dates: start is the later of Monday or today.
  const start = today > monday ? today : monday

  return { start, end }
}

export function isDateInBookingWindow(dateStr: string, nowISO?: string): boolean {
  const { start, end } = getClientBookingWindow(nowISO)
  return dateStr >= start && dateStr <= end && weekdayOf(dateStr) !== 0
}

export function getBookingWeekDates(nowISO?: string): string[] {
  const { start, end } = getClientBookingWindow(nowISO)
  const dates: string[] = []
  let cur = start
  while (cur <= end) {
    if (weekdayOf(cur) !== 0) dates.push(cur) // skip Sunday
    cur = addDays(cur, 1)
  }
  return dates
}
