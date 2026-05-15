import { describe, it, expect } from 'vitest'
import { normalizePhone, phoneToEmail, isValidBrazilianPhone } from './phone'

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
  it('accepts 10-digit landline', () => {
    expect(isValidBrazilianPhone('1133334444')).toBe(true)
  })
  it('rejects short numbers', () => {
    expect(isValidBrazilianPhone('123')).toBe(false)
  })
})
