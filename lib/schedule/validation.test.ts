import { describe, it, expect } from 'vitest'
import { isHalfHourStep, validateHoursInput, validateOverrideDate } from './validation'

describe('isHalfHourStep', () => {
  it('accepts HH:00 and HH:30', () => {
    expect(isHalfHourStep('10:00')).toBe(true)
    expect(isHalfHourStep('19:30')).toBe(true)
  })
  it('rejects other minutes and garbage', () => {
    expect(isHalfHourStep('10:15')).toBe(false)
    expect(isHalfHourStep('abc')).toBe(false)
    expect(isHalfHourStep('25:00')).toBe(false)
  })
})

describe('validateHoursInput', () => {
  it('accepts a valid range', () => expect(validateHoursInput('10:00', '20:00')).toBeNull())
  it('rejects close <= open', () => expect(validateHoursInput('20:00', '10:00')).toMatch(/fechamento/i))
  it('rejects non-30-min steps', () => expect(validateHoursInput('10:15', '20:00')).toMatch(/30/))
})

describe('validateOverrideDate', () => {
  it('accepts today and future weekdays', () => {
    expect(validateOverrideDate('2027-01-15', '2027-01-13')).toBeNull()
  })
  it('rejects past dates', () => {
    expect(validateOverrideDate('2027-01-12', '2027-01-13')).toMatch(/passado/i)
  })
  it('rejects Sundays', () => {
    expect(validateOverrideDate('2027-01-17', '2027-01-13')).toMatch(/domingo/i)
  })
})
