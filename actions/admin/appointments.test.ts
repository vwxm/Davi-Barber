import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const requireAdmin = vi.fn(async () => null as { error: string } | null)
vi.mock('@/lib/supabase/require-admin', () => ({ requireAdmin: () => requireAdmin() }))

const createAdminClient = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => createAdminClient() }))

import {
  markAppointmentCompleted,
  markAppointmentNoShow,
  cancelAppointmentAdmin,
} from './appointments'

// Chainable supabase stub: every builder method returns the chain; the terminal
// `select` resolves to the provided result.
function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  for (const m of ['from', 'update', 'eq']) {
    chain[m] = vi.fn(() => chain)
  }
  chain.select = vi.fn(() => Promise.resolve(result))
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  requireAdmin.mockResolvedValue(null)
})

describe('markAppointmentCompleted', () => {
  it('updates a scheduled appointment to completed', async () => {
    createAdminClient.mockReturnValue(makeChain({ data: [{ id: 'a1' }], error: null }))
    const result = await markAppointmentCompleted('a1')
    expect(result).toEqual({})
  })

  it('errors when no scheduled row matched', async () => {
    createAdminClient.mockReturnValue(makeChain({ data: [], error: null }))
    const result = await markAppointmentCompleted('a1')
    expect(result.error).toBe('Agendamento não encontrado ou não está agendado.')
  })
})

describe('markAppointmentNoShow', () => {
  it('updates a scheduled appointment to no_show', async () => {
    createAdminClient.mockReturnValue(makeChain({ data: [{ id: 'a1' }], error: null }))
    const result = await markAppointmentNoShow('a1')
    expect(result).toEqual({})
  })
})

describe('cancelAppointmentAdmin', () => {
  it('cancels a scheduled appointment', async () => {
    createAdminClient.mockReturnValue(makeChain({ data: [{ id: 'a1' }], error: null }))
    const result = await cancelAppointmentAdmin('a1')
    expect(result).toEqual({})
  })

  it('blocks non-admins', async () => {
    requireAdmin.mockResolvedValue({ error: 'Acesso restrito.' })
    const result = await cancelAppointmentAdmin('a1')
    expect(result.error).toBe('Acesso restrito.')
  })
})
