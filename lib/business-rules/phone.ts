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
