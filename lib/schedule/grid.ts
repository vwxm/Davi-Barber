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
      const blocked = activeBlocks.some(
        (b) => b.full_day || (b.start_time && b.end_time && overlaps(t, end, b.start_time, b.end_time)),
      )
      state = blocked ? 'bloqueado' : 'aberto'
    }
    grid.push({ start: minutesToTime(t), state })
  }
  return grid
}

// Blocking a slot at the EDGE of the day's range means "close this hour":
// the range shrinks past every edge slot that is blocked by its own solo
// (single-slot, single-date) block, and those throwaway blocks are removed —
// the slots go back to "fechado". Mid-day blocks and slots covered by wider
// blocks are untouched. Returns null when there is nothing to shrink (or when
// every slot is blocked — a range must never become empty).
export interface ShrinkSlotInfo {
  start: string
  state: SlotState
  // true when the slot is blocked ONLY by exact single-slot blocks of this date
  soloBlocked: boolean
}

export function computeShrink(
  hours: EffectiveHours,
  slots: ShrinkSlotInfo[], // grid slots inside [open, close), in order
): { open: string; close: string; removed: string[] } | null {
  let lo = 0
  let hi = slots.length - 1
  const removed: string[] = []

  while (lo <= hi && slots[lo].state === 'bloqueado' && slots[lo].soloBlocked) lo++
  while (hi >= lo && slots[hi].state === 'bloqueado' && slots[hi].soloBlocked) hi--

  if (lo > hi) return null // everything blocked — keep the range
  if (lo === 0 && hi === slots.length - 1) return null // nothing to shrink

  for (let i = 0; i < lo; i++) removed.push(slots[i].start)
  for (let i = hi + 1; i < slots.length; i++) removed.push(slots[i].start)

  return {
    open: slots[lo].start,
    close: minutesToTime(timeToMinutes(slots[hi].start) + SLOT_MINUTES),
    removed,
  }
}

// Opening a "fechado" slot extends the day's range to include it. Slots that
// fall inside the new range but were previously closed (the gap) come back
// BLOCKED, so tapping 21:00 doesn't silently open 20:00 and 20:30 too.
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
