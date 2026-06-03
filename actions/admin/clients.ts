'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { phoneToEmail, isValidBrazilianPhone } from '@/lib/business-rules/phone'

// Admin-assisted password reset. Clients authenticate by phone and the app has
// no SMS/email channel, so self-service reset can't be verified securely; the
// barber resets a client's password in person instead.
export async function resetClientPassword(
  phone: string,
  newPassword: string,
): Promise<{ error?: string }> {
  const authError = await requireAdmin()
  if (authError) return authError

  if (!isValidBrazilianPhone(phone)) return { error: 'Telefone inválido.' }
  if (!newPassword || newPassword.length < 8) {
    return { error: 'A senha deve ter pelo menos 8 caracteres.' }
  }

  const email = phoneToEmail(phone)
  const supabase = createAdminClient()

  // Find the auth user by the deterministic phone-derived email.
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listError) return { error: 'Erro ao buscar usuários.' }

  const user = list.users.find((u) => u.email === email)
  if (!user) return { error: 'Cliente não encontrado com esse telefone.' }

  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    password: newPassword,
  })
  if (error) return { error: 'Erro ao redefinir a senha.' }

  return {}
}
