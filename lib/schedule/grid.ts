import { timeToMinutes, minutesToTime, blockCoversDate, SLOT_MINUTES, type EffectiveHours } from '@/lib/business-rules/slots'
import type { Appointment, ScheduleBlock } from '@/types'

// Visual admin grid: fixed slot range so the barber can also ADD hours
// outside the current effective range by tapping "fechado" slots.
export const GRID_START = '06:00'
export const GRID_END = '23:30'

export type SlotState = 'aberto' | 'bloqueado' | 'fechado' | 'ocupado'

export interface GridSlot {
  start: string // 'HH:MM'
  state: SlotState
}

function overlaps(startMin: number, endMin: number, start: string, end: string): boolean {
  return startMin < timeToMinutes(end) && endMin > timeToMinutes(start)
}

// State per slot:
// - ocupado: has a scheduled appointment (locked);
// - fechado: outside the day's range, OR inside it but covered only by
//   kind='fechado' blocks (hour removed from the day — grey);
// - bloqueado: covered by a kind='bloqueio' block (red hole in the day);
// - aberto: inside the range, free.
export function computeDayGrid(
  date: string,
  hours: EffectiveHours,
  blocks: ScheduleBlock[],
  appointments: Appointment[],
): GridSlot[] {
  const openMin = timeToMinutes(hours.start)
  const closeMin = timeToMinutes(hours.end)
  const activeBlocks = blocks.filter((b) => b.active && blockCoversDate(b, date))
  const scheduled = appointments.filter((a) => a.status === 'scheduled' && a.date === date)

  const grid: GridSlot[] = []
  for (let t = timeToMinutes(GRID_START); t <= timeToMinutes(GRID_END); t += SLOT_MINUTES) {
    const end = t + SLOT_MINUTES
    const occupied = scheduled.some((a) => overlaps(t, end, a.start_time, a.end_time))
    let state: SlotState
    if (occupied) {
      state = 'ocupado'
    } else if (t < openMin || end > closeMin) {
      state = 'fechado'
    } else {
      const covering = activeBlocks.filter(
        (b) => b.full_day || (b.start_time && b.end_time && overlaps(t, end, b.start_time, b.end_time)),
      )
      if (covering.length === 0) {
        state = 'aberto'
      } else if (covering.every((b) => b.kind === 'fechado')) {
        state = 'fechado'
      } else {
        state = 'bloqueado'
      }
    }
    grid.push({ start: minutesToTime(t), state })
  }
  return grid
}

// Opening a "fechado" slot outside the day's range extends the range to
// include it. Slots that fall inside the new range but were previously closed
// (the gap) come back as kind='fechado' blocks, so tapping 21:00 doesn't
// silently open 20:00 and 20:30 too.
export function computeExtension(
  hours: EffectiveHours,
  slotStart: string,
): { open: string; close: string; gaps: string[] } {
  const openMin = timeToMinutes(hours.start)
  const closeMin = timeToMinutes(hours.end)
  const t = timeToMinutes(slotStart)
  const slotEnd = t + SLOT_MINUTES

  const newOpen = Math.min(openMin, t)
  const newClose = Math.max(closeMin, slotEnd)

  const gaps: string[] = []
  // Gap before the old opening (when extending earlier).
  for (let g = newOpen; g < openMin; g += SLOT_MINUTES) {
    if (g !== t) gaps.push(minutesToTime(g))
  }
  // Gap after the old close (when extending later).
  for (let g = closeMin; g + SLOT_MINUTES <= newClose; g += SLOT_MINUTES) {
    if (g !== t) gaps.push(minutesToTime(g))
  }

  return { open: minutesToTime(newOpen), close: minutesToTime(newClose), gaps }
}
