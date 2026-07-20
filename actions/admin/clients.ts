'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { phoneToEmail, isValidBrazilianPhone, normalizePhone } from '@/lib/business-rules/phone'
import type { Client } from '@/types'

// Admin-created client account. Same trigger that backs client self-signup
// (on_auth_user_created) creates the public.clients row — this just creates
// the auth user with the phone-derived email the app uses as login.
export async function createClientAccount(data: {
  name: string
  phone: string
  password: string
}): Promise<{ client?: Client; error?: string }> {
  const authError = await requireAdmin()
  if (authError) return authError

  const name = data.name.trim()
  if (!name || name.length < 2) return { error: 'Nome deve ter pelo menos 2 caracteres.' }
  if (!isValidBrazilianPhone(data.phone)) return { error: 'Telefone inválido.' }
  if (!data.password || data.password.length < 8) {
    return { error: 'A senha deve ter pelo menos 8 caracteres.' }
  }

  const email = phoneToEmail(data.phone)
  const cleanPhone = normalizePhone(data.phone)
  const supabase = createAdminClient()

  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password: data.password,
    email_confirm: true,
    user_metadata: { name, phone: cleanPhone },
  })

  if (error) {
    if (error.message?.toLowerCase().includes('already') || error.code === 'email_exists') {
      return { error: 'Telefone já cadastrado.' }
    }
    return { error: 'Erro ao criar cliente.' }
  }
  if (!created.user) return { error: 'Erro ao criar cliente.' }

  const { data: client, error: fetchError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', created.user.id)
    .single()

  if (fetchError || !client) return { error: 'Cliente criado, mas houve erro ao carregar os dados.' }

  revalidatePath('/admin/clientes')
  return { client: client as Client }
}

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
