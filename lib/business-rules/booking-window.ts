import { TIMEZONE } from './slots'

// How many weeks ahead clients may book (1 = current week only, 2 = current + next).
export const BOOKING_WEEKS = 2

export interface BookingWindow {
  start: Date
  end: Date
}

export function getClientBookingWindow(): BookingWindow {
  const now = new Date()
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
  const today = new Date(todayStr + 'T00:00:00')

  const weekday = today.getDay() // 0=Dom
  // Se hoje for domingo, começa amanhã (segunda). Caso contrário, começa na segunda desta semana.
  const daysToMonday = weekday === 0 ? 1 : 1 - weekday
  const monday = new Date(today)
  monday.setDate(today.getDate() + daysToMonday)

  // Saturday of the last bookable week.
  const saturday = new Date(monday)
  saturday.setDate(monday.getDate() + 5 + (BOOKING_WEEKS - 1) * 7)

  // start is the later of monday or today — never show/allow past dates
  const start = today > monday ? today : monday

  return { start, end: saturday }
}

export function isDateInBookingWindow(dateStr: string): boolean {
  const { start, end } = getClientBookingWindow()
  const date = new Date(dateStr + 'T00:00:00')
  return date >= start && date <= end
}

export function getBookingWeekDates(): string[] {
  const { start, end } = getClientBookingWindow()
  const dates: string[] = []
  const current = new Date(start)
  while (current <= end) {
    // Use locale string to avoid UTC offset shifting the date
    const dateStr = current.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
    if (current.getDay() !== 0) { // remove domingo
      dates.push(dateStr)
    }
    current.setDate(current.getDate() + 1)
  }
  return dates
}
