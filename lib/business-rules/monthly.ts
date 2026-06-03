import { TIMEZONE } from './slots'

// Date math anchored at UTC noon avoids timezone/DST edge cases for whole-day
// arithmetic on 'YYYY-MM-DD' strings.

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Calendar date in the business timezone for a given instant.
function localDateStr(nowISO: string): string {
  return new Date(nowISO).toLocaleDateString('en-CA', { timeZone: TIMEZONE })
}

function weekdayOf(dateStr: string): number {
  return new Date(dateStr + 'T12:00:00Z').getUTCDay() // 0=Sun..6=Sat
}

// Monday ('YYYY-MM-DD') of the week containing `nowISO`, in the business tz.
// Sunday is treated as the last day of the week that just ended.
export function currentWeekMonday(nowISO: string): string {
  const today = localDateStr(nowISO)
  const dow = weekdayOf(today)
  const diffToMonday = dow === 0 ? -6 : 1 - dow
  return addDays(today, diffToMonday)
}

// Date ('YYYY-MM-DD') of `weekday` (0=Sun..6=Sat) within the current week.
export function weekdayDateInCurrentWeek(weekday: number, nowISO: string): string {
  const monday = currentWeekMonday(nowISO)
  const offset = weekday === 0 ? 6 : weekday - 1 // Mon=0 .. Sat=5, Sun=6
  return addDays(monday, offset)
}
