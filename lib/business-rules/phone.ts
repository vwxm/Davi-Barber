export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function phoneToEmail(phone: string): string {
  return `${normalizePhone(phone)}@davibarber.app`
}

export function isValidBrazilianPhone(phone: string): boolean {
  const digits = normalizePhone(phone)
  // DDD (2 digits) + 9 + 8 digits = 11 digits, mobile only
  return digits.length === 11 && digits[2] === '9'
}

// Progressive mask for input: '(11) 99999-9999'. Caps at 11 digits.
export function formatPhoneInput(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}
