export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function phoneToEmail(phone: string): string {
  return `${normalizePhone(phone)}@davibarber.app`
}

export function isValidBrazilianPhone(phone: string): boolean {
  const digits = normalizePhone(phone)
  return digits.length >= 10 && digits.length <= 11
}
