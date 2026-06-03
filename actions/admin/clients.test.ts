import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const requireAdmin = vi.fn(async () => null as { error: string } | null)
vi.mock('@/lib/supabase/require-admin', () => ({ requireAdmin: () => requireAdmin() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { resetClientPassword } from './clients'

beforeEach(() => {
  vi.clearAllMocks()
  requireAdmin.mockResolvedValue(null)
})

describe('resetClientPassword validation', () => {
  it('blocks non-admins', async () => {
    requireAdmin.mockResolvedValue({ error: 'Acesso restrito.' })
    const result = await resetClientPassword('11999999999', 'senha1234')
    expect(result.error).toBe('Acesso restrito.')
  })

  it('rejects an invalid phone', async () => {
    const result = await resetClientPassword('123', 'senha1234')
    expect(result.error).toBe('Telefone inválido.')
  })

  it('rejects a short password', async () => {
    const result = await resetClientPassword('11999999999', 'curta')
    expect(result.error).toBe('A senha deve ter pelo menos 8 caracteres.')
  })
})
