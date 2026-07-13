import type { Appointment, ScheduleBlock, TimeSlot } from '@/types'

export interface EffectiveHours {
  start: string // 'HH:MM'
  end: string   // 'HH:MM'
}

export const SLOT_MINUTES = 30
export const CLOSED_WEEKDAYS = [0] // domingo

export const TIMEZONE = process.env.BARBERSHOP_TIMEZONE ?? 'America/Sao_Paulo'

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0')
  const m = (minutes % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

function rangesOverlap(
  start1: string, end1: string,
  start2: string, end2: string
): boolean {
  return timeToMinutes(start1) < timeToMinutes(end2) &&
         timeToMinutes(end1) > timeToMinutes(start2)
}

// True when `date` falls within the block's date span. A block with a null
// date_end covers only its single `date`; a period block covers [date, date_end]
// inclusive. Lexicographic comparison of 'YYYY-MM-DD' strings is order-correct.
export function blockCoversDate(block: ScheduleBlock, date: string): boolean {
  return block.date <= date && (block.date_end ?? block.date) >= date
}

export function getAvailableSlots(
  date: string,
  durationMinutes: number,
  appointments: Appointment[],
  blocks: ScheduleBlock[],
  nowISO: string,
  hours: EffectiveHours,
  minLeadMinutes = 0,
): TimeSlot[] {
  // T12:00:00Z ensures the UTC date matches the calendar date in any timezone
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay()
  if (CLOSED_WEEKDAYS.includes(weekday)) return []

  const fullDayBlock = blocks.find(b => b.active && b.full_day && blockCoversDate(b, date))
  if (fullDayBlock) return []

  const startMin = timeToMinutes(hours.start)
  const endMin = timeToMinutes(hours.end)
  const slots: TimeSlot[] = []

  const now = new Date(nowISO)
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
  const isToday = date === todayStr
  const nowMinutes = isToday
    ? (() => {
        const t = now.toLocaleTimeString('en-GB', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' })
        const [h, m] = t.split(':').map(Number)
        return h * 60 + m
      })()
    : 0

  for (let t = startMin; t + durationMinutes <= endMin; t += SLOT_MINUTES) {
    const slotStart = minutesToTime(t)
    const slotEnd = minutesToTime(t + durationMinutes)

    // Same-day: a client can only pick slots at least minLeadMinutes away
    // (lead 0 preserves the old "no past slots" behavior).
    if (isToday && (minLeadMinutes > 0 ? t < nowMinutes + minLeadMinutes : t <= nowMinutes)) continue

    const blockedByBlock = blocks.some(b =>
      b.active && !b.full_day &&
      b.start_time && b.end_time &&
      blockCoversDate(b, date) &&
      rangesOverlap(slotStart, slotEnd, b.start_time, b.end_time)
    )
    if (blockedByBlock) continue

    const hasConflict = appointments.some(a =>
      a.status === 'scheduled' && a.date === date &&
      rangesOverlap(slotStart, slotEnd, a.start_time, a.end_time)
    )

    slots.push({ start: slotStart, end: slotEnd, available: !hasConflict })
  }

  return slots
}
