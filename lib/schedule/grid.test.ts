import { describe, it, expect } from 'vitest'
import { computeDayGrid, computeExtension, GRID_START, GRID_END } from './grid'
import type { Appointment, ScheduleBlock } from '@/types'

const HOURS = { start: '10:00', end: '20:00' }
const DATE = '2027-01-15' // Friday

function appt(partial: Partial<Appointment>): Appointment {
  return {
    id: 'a', client_id: 'c', service_id: 's', date: DATE,
    start_time: '10:00', end_time: '10:30', status: 'scheduled',
    access_code: 'X', monthly_client_id: null, week_start: null,
    created_at: '', updated_at: '',
  } as Appointment
}

function block(partial: Partial<ScheduleBlock>): ScheduleBlock {
  return {
    id: 'b', date: DATE, date_end: null, full_day: false,
    start_time: '11:00', end_time: '11:30', reason: null, active: true,
    kind: 'bloqueio', created_at: '', updated_at: '', ...partial,
  }
}

function stateOf(grid: ReturnType<typeof computeDayGrid>, start: string) {
  return grid.find((s) => s.start === start)?.state
}

describe('computeDayGrid', () => {
  it('covers 06:00..23:30', () => {
    const grid = computeDayGrid(DATE, HOURS, [], [])
    expect(grid[0].start).toBe(GRID_START)
    expect(grid[grid.length - 1].start).toBe(GRID_END)
    expect(grid).toHaveLength(36)
  })

  it('marks inside-hours free slots aberto, outside fechado', () => {
    const grid = computeDayGrid(DATE, HOURS, [], [])
    expect(stateOf(grid, '09:30')).toBe('fechado')
    expect(stateOf(grid, '10:00')).toBe('aberto')
    expect(stateOf(grid, '19:30')).toBe('aberto')
    expect(stateOf(grid, '20:00')).toBe('fechado')
  })

  it('marks blocked slots inside hours', () => {
    const grid = computeDayGrid(DATE, HOURS, [block({ start_time: '11:00', end_time: '12:00' })], [])
    expect(stateOf(grid, '11:00')).toBe('bloqueado')
    expect(stateOf(grid, '11:30')).toBe('bloqueado')
    expect(stateOf(grid, '12:00')).toBe('aberto')
  })

  it('full-day block marks every inside-hours slot bloqueado', () => {
    const grid = computeDayGrid(DATE, HOURS, [block({ full_day: true, start_time: null, end_time: null })], [])
    expect(stateOf(grid, '10:00')).toBe('bloqueado')
    expect(stateOf(grid, '19:30')).toBe('bloqueado')
    expect(stateOf(grid, '09:30')).toBe('fechado')
  })

  it('occupied wins over everything, even outside hours', () => {
    const appts = [
      { ...appt({}), start_time: '10:00', end_time: '10:30' },
      { ...appt({}), id: 'a2', start_time: '09:00', end_time: '09:30' }, // legacy, outside grid hours
    ] as Appointment[]
    const grid = computeDayGrid(DATE, HOURS, [block({ start_time: '10:00', end_time: '10:30' })], appts)
    expect(stateOf(grid, '10:00')).toBe('ocupado')
    expect(stateOf(grid, '09:00')).toBe('ocupado')
  })

  it('ignores canceled appointments and inactive blocks', () => {
    const grid = computeDayGrid(
      DATE,
      HOURS,
      [block({ active: false })],
      [{ ...appt({}), status: 'canceled' } as Appointment],
    )
    expect(stateOf(grid, '10:00')).toBe('aberto')
    expect(stateOf(grid, '11:00')).toBe('aberto')
  })

  it('a 60-min appointment occupies both slots', () => {
    const grid = computeDayGrid(DATE, HOURS, [], [{ ...appt({}), start_time: '14:00', end_time: '15:00' } as Appointment])
    expect(stateOf(grid, '14:00')).toBe('ocupado')
    expect(stateOf(grid, '14:30')).toBe('ocupado')
    expect(stateOf(grid, '15:00')).toBe('aberto')
  })
})

describe('computeDayGrid — kind fechado', () => {
  it('kind=fechado blocks show as fechado (grey), not bloqueado', () => {
    const grid = computeDayGrid(DATE, HOURS, [block({ kind: 'fechado', start_time: '15:00', end_time: '15:30' })], [])
    expect(stateOf(grid, '15:00')).toBe('fechado')
    expect(stateOf(grid, '15:30')).toBe('aberto')
  })

  it('a bloqueio covering the same slot wins over fechado', () => {
    const grid = computeDayGrid(DATE, HOURS, [
      block({ id: 'b1', kind: 'fechado', start_time: '15:00', end_time: '15:30' }),
      block({ id: 'b2', kind: 'bloqueio', start_time: '15:00', end_time: '15:30' }),
    ], [])
    expect(stateOf(grid, '15:00')).toBe('bloqueado')
  })
})

describe('computeExtension', () => {
  it('extends the close when opening a later slot, blocking the gap', () => {
    const ext = computeExtension(HOURS, '21:00')
    expect(ext.open).toBe('10:00')
    expect(ext.close).toBe('21:30')
    expect(ext.gaps).toEqual(['20:00', '20:30'])
  })

  it('extends the open when opening an earlier slot, blocking the gap', () => {
    const ext = computeExtension(HOURS, '08:00')
    expect(ext.open).toBe('08:00')
    expect(ext.close).toBe('20:00')
    expect(ext.gaps).toEqual(['08:30', '09:00', '09:30'])
  })

  it('adjacent slot extends with no gap', () => {
    const ext = computeExtension(HOURS, '20:00')
    expect(ext.close).toBe('20:30')
    expect(ext.gaps).toEqual([])
    const ext2 = computeExtension(HOURS, '09:30')
    expect(ext2.open).toBe('09:30')
    expect(ext2.gaps).toEqual([])
  })
})
