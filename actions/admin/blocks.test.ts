import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const requireAdmin = vi.fn(async () => null as { error: string } | null)
vi.mock('@/lib/supabase/require-admin', () => ({ requireAdmin: () => requireAdmin() }))

const createAdminClient = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => createAdminClient() }))

import { createBlock } from './blocks'

// Chainable stub whose terminal `single` resolves to the result.
function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  for (const m of ['from', 'insert', 'select']) {
    chain[m] = vi.fn(() => chain)
  }
  chain.single = vi.fn(() => Promise.resolve(result))
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  requireAdmin.mockResolvedValue(null)
})

describe('createBlock validation', () => {
  it('blocks non-admins', async () => {
    requireAdmin.mockResolvedValue({ error: 'Acesso restrito.' })
    const result = await createBlock({ date: '2999-01-01', full_day: true })
    expect(result.error).toBe('Acesso restrito.')
  })

  it('rejects a past date', async () => {
    const result = await createBlock({ date: '2000-01-01', full_day: true })
    expect(result.error).toBe('A data não pode ser no passado.')
  })

  it('rejects a period whose end is before its start', async () => {
    const result = await createBlock({ date: '2999-01-02', date_end: '2999-01-01', full_day: true })
    expect(result.error).toBe('A data fim deve ser igual ou após a data início.')
  })

  it('requires start and end for a partial block', async () => {
    const result = await createBlock({ date: '2999-01-01', full_day: false })
    expect(result.error).toBe('Horário de início e fim são obrigatórios.')
  })

  it('rejects a partial block with end before start', async () => {
    const result = await createBlock({
      date: '2999-01-01', full_day: false, start_time: '14:00', end_time: '13:00',
    })
    expect(result.error).toBe('Horário de fim deve ser após o horário de início.')
  })

  it('creates a valid full-day block', async () => {
    const block = { id: 'b1', date: '2999-01-01', full_day: true }
    createAdminClient.mockReturnValue(makeChain({ data: block, error: null }))
    const result = await createBlock({ date: '2999-01-01', full_day: true })
    expect(result.block).toEqual(block)
    expect(result.error).toBeUndefined()
  })
})
