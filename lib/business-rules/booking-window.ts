import { TIMEZONE } from './slots'

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

  const saturday = new Date(monday)
  saturday.setDate(monday.getDate() + 5)

  return { start: monday, end: saturday }
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
    const dateStr = current.toISOString().split('T')[0]
    if (new Date(dateStr + 'T00:00:00').getDay() !== 0) { // remove domingo
      dates.push(dateStr)
    }
    current.setDate(current.getDate() + 1)
  }
  return dates
}
