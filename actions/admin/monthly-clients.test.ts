import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

// requireAdmin: authorized by default (returns null).
const requireAdmin = vi.fn(async () => null as { error: string } | null)
vi.mock('@/lib/supabase/require-admin', () => ({ requireAdmin: () => requireAdmin() }))

// Heavy side-effect deps stubbed out.
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/monthly/ensure', () => ({ ensureCurrentWeekMonthlyAppointments: vi.fn() }))

import { createMonthlyClient } from './monthly-clients'

beforeEach(() => {
  vi.clearAllMocks()
  requireAdmin.mockResolvedValue(null)
})

const base = { client_id: 'c1', service_id: 's1', weekday: 5, start_time: '09:30' }

describe('createMonthlyClient validation', () => {
  it('blocks non-admins', async () => {
    requireAdmin.mockResolvedValue({ error: 'Acesso restrito.' })
    const result = await createMonthlyClient(base)
    expect(result.error).toBe('Acesso restrito.')
  })

  it('rejects Sunday (weekday 0)', async () => {
    const result = await createMonthlyClient({ ...base, weekday: 0 })
    expect(result.error).toBe('Domingo não tem atendimento.')
  })

  it('requires a client', async () => {
    const result = await createMonthlyClient({ ...base, client_id: '' })
    expect(result.error).toBe('Cliente é obrigatório.')
  })

  it('requires a service', async () => {
    const result = await createMonthlyClient({ ...base, service_id: '' })
    expect(result.error).toBe('Serviço é obrigatório.')
  })

  it('rejects out-of-range weekday', async () => {
    const result = await createMonthlyClient({ ...base, weekday: 9 })
    expect(result.error).toBe('Dia da semana inválido.')
  })

  it('requires a start time', async () => {
    const result = await createMonthlyClient({ ...base, start_time: '' })
    expect(result.error).toBe('Horário é obrigatório.')
  })
})
