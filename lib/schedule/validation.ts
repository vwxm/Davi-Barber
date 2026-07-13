export function isHalfHourStep(time: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(time)) return false
  const [h, m] = time.split(':').map(Number)
  if (h > 23) return false
  return m === 0 || m === 30
}

export function validateHoursInput(open: string, close: string): string | null {
  if (!isHalfHourStep(open) || !isHalfHourStep(close)) {
    return 'Horários devem ser em passos de 30 minutos (ex.: 10:00, 10:30).'
  }
  if (close <= open) return 'O fechamento deve ser depois da abertura.'
  return null
}

export function validateOverrideDate(date: string, todayStr: string): string | null {
  if (date < todayStr) return 'A data não pode ser no passado.'
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay()
  if (weekday === 0) return 'Domingo não tem atendimento.'
  return null
}
