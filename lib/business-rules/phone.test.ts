import { describe, it, expect } from 'vitest'
import { normalizePhone, phoneToEmail, isValidBrazilianPhone, formatPhoneInput } from './phone'

describe('normalizePhone', () => {
  it('strips formatting', () => {
    expect(normalizePhone('+55 (11) 99999-9999')).toBe('5511999999999')
  })
  it('leaves digits only', () => {
    expect(normalizePhone('11999999999')).toBe('11999999999')
  })
})

describe('phoneToEmail', () => {
  it('generates fake email from phone', () => {
    expect(phoneToEmail('(11) 99999-9999')).toBe('11999999999@davibarber.app')
  })
})

describe('isValidBrazilianPhone', () => {
  it('accepts 11-digit mobile', () => {
    expect(isValidBrazilianPhone('11999999999')).toBe(true)
  })
  it('rejects 10-digit landline (mobile only)', () => {
    expect(isValidBrazilianPhone('1133334444')).toBe(false)
  })
  it('rejects short numbers', () => {
    expect(isValidBrazilianPhone('123')).toBe(false)
  })
})

describe('formatPhoneInput', () => {
  it('formats progressively', () => {
    expect(formatPhoneInput('11')).toBe('(11')
    expect(formatPhoneInput('1199999')).toBe('(11) 99999')
    expect(formatPhoneInput('11999998888')).toBe('(11) 99999-8888')
  })
  it('strips non-digits and caps at 11 digits', () => {
    expect(formatPhoneInput('(11) 99999-8888999')).toBe('(11) 99999-8888')
  })
  it('returns empty for empty input', () => {
    expect(formatPhoneInput('')).toBe('')
  })
})
